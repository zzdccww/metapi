import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('administrator authentication boundaries', () => {
  it('validates effective credentials after hydration and before building the server', () => {
    const server = source('src/server/index.ts');
    const hydrate = server.indexOf('applyRuntimeSettings(finalMap)');
    const validate = server.indexOf('assertSafeAdminCredentials(config)');
    const build = server.indexOf('Fastify(buildFastifyOptions(config))');
    expect(hydrate).toBeGreaterThanOrEqual(0);
    expect(validate).toBeGreaterThan(hydrate);
    expect(build).toBeGreaterThan(validate);
  });
  it('leaves forwarding resolution at Fastify instead of repeating raw-header trust', () => {
    for (const path of ['src/server/middleware/auth.ts', 'src/server/middleware/requestRateLimit.ts', 'src/server/routes/api/settings.ts']) {
      expect(source(path), path).not.toContain('x-forwarded-for');
    }
  });
});
