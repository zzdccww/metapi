import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('frontend delivery boundaries', () => {
  it('builds only the original interface', () => {
    const manifest = JSON.parse(source('package.json'));
    expect(manifest.scripts['build:web']).toBe('npm run desktop:icons && vite build');
    expect(Object.keys(manifest.scripts).some(key => key.includes('evolution') || key === 'build:web:legacy')).toBe(false);
    expect(source('vite.config.ts')).toContain("root: 'src/web'");
    expect(source('vite.config.ts')).not.toContain('METAPI_WEB_UI');
    expect(existsSync(resolve('New metapi Evolution Webui/metapi/src/App.tsx'))).toBe(false);
  });

  it('keeps frontend alias decisions in their shared owner', () => {
    const server = source('src/server/index.ts');
    expect(server).toContain('frontendRedirectForPath(request.url)');
    expect(server).not.toContain("'/app/dashboard'");
    expect(server).toContain('setHeaders: setFrontendCacheHeaders');
  });
});
