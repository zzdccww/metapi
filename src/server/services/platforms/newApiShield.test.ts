import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const vmCalls: string[] = [];
vi.mock('node:vm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:vm')>();
  return {
    ...actual,
    createContext: (...args: Parameters<typeof actual.createContext>) => {
      vmCalls.push('createContext');
      return actual.createContext(...args);
    },
    runInContext: (...args: Parameters<typeof actual.runInContext>) => {
      vmCalls.push('runInContext');
      return actual.runInContext(...args);
    },
  };
});

const { solveNewApiAcwScV2 } = await import('./newApiShield.js');
const { NewApiAdapter } = await import('./newApi.js');

const CHALLENGE_HTML = readFileSync(new URL('./__fixtures__/anyrouter-challenge.html', import.meta.url), 'utf8');
const CHALLENGE_ACW = '699dbedad126579b6bc0ebb91eaae8d7af3548b5';
const MARKER = '__metapiShieldTestMarker';

type PrivateSolver = { solveAcwScV2(html: string): string | null };

function adapterSolver(): PrivateSolver {
  return new NewApiAdapter() as unknown as PrivateSolver;
}

afterEach(() => {
  vmCalls.length = 0;
  delete (globalThis as Record<string, unknown>)[MARKER];
  vi.restoreAllMocks();
});

describe('new-api shield challenge solver', () => {
  it('solves the challenge by parsing data only, without node:vm', () => {
    expect(solveNewApiAcwScV2(CHALLENGE_HTML)).toBe(CHALLENGE_ACW);
    expect(adapterSolver().solveAcwScV2(CHALLENGE_HTML)).toBe(CHALLENGE_ACW);
    expect(vmCalls).toEqual([]);
  });

  it('does not run upstream-supplied script from the challenge page', () => {
    // Plant script in the regions the previous vm-based solver used to execute.
    // The constructor chain is the escape that reached the host realm from a
    // node:vm context; a plain globalThis write would only touch the sandbox.
    const marker = `try{this.constructor.constructor('return globalThis')().${MARKER}=true;}catch(e){}try{globalThis.${MARKER}=true;}catch(e){}`;
    const tampered = CHALLENGE_HTML
      .replace('function a0i(){', `function a0i(){${marker}`)
      .replace('(function(a,c){', `(function(a,c){${marker}`);
    expect(tampered).not.toBe(CHALLENGE_HTML);

    solveNewApiAcwScV2(tampered);
    adapterSolver().solveAcwScV2(tampered);

    expect((globalThis as Record<string, unknown>)[MARKER]).toBeUndefined();
    expect(vmCalls).toEqual([]);
  });

  it('fails closed when arg1 or the mapping is missing', () => {
    expect(solveNewApiAcwScV2('<html><script>var arg1="ABC123";</script></html>')).toBeNull();
    expect(solveNewApiAcwScV2(CHALLENGE_HTML.replace('var arg1=', 'var other='))).toBeNull();
    expect(vmCalls).toEqual([]);
  });

  it('fails closed and warns when the seed is absent or ambiguous', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const emptiedTable = CHALLENGE_HTML.replace(/function a0i\(\)\{var N=\[[^\]]*\]/, 'function a0i(){var N=[]');
    expect(emptiedTable).not.toBe(CHALLENGE_HTML);
    expect(solveNewApiAcwScV2(emptiedTable)).toBeNull();

    // A second table entry that decodes to a different 40-character hex string
    // must make the solve ambiguous rather than letting the first match win.
    const decoyEncoded = Buffer.from('a'.repeat(40), 'utf8')
      .toString('base64')
      .replace(/[a-zA-Z]/g, (ch) => (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()));
    const ambiguous = CHALLENGE_HTML.replace('function a0i(){var N=[', `function a0i(){var N=['${decoyEncoded}',`);
    expect(ambiguous).not.toBe(CHALLENGE_HTML);
    expect(solveNewApiAcwScV2(ambiguous)).toBeNull();

    expect(warn).toHaveBeenCalledTimes(2);
    expect(vmCalls).toEqual([]);
  });

  it('still solves a page with trailing padding around the challenge', () => {
    const padded = `${CHALLENGE_HTML}${'<!-- x -->'.repeat(500)}`;
    expect(padded.length).toBeGreaterThan(CHALLENGE_HTML.length);

    expect(solveNewApiAcwScV2(padded)).toBe(CHALLENGE_ACW);
    expect(vmCalls).toEqual([]);
  });
});
