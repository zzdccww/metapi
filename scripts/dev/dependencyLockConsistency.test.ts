import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const manifests = [
  ['package.json', 'package-lock.json'],
  ['New metapi Evolution Webui/metapi/package.json', 'New metapi Evolution Webui/metapi/package-lock.json'],
] as const;

/**
 * Use the Dockerfile's npm pin on its Node 22 builder runtime. The base image's
 * bundled npm 10 rejects this project's Vite overrides, so testing that installer
 * would contradict the actual release build.
 */
describe('dependency lockfile consistency', () => {
  it.skipIf(process.platform === 'win32' || !existsSync('/usr/bin/docker'))(
    'completes npm ci on the Docker builder Node/npm major',
    () => {
      const dockerfile = readFileSync(join(repoRoot, 'docker/Dockerfile'), 'utf8');
      const npmVersion = /^RUN npm install --global npm@(\d+\.\d+\.\d+)\b/m.exec(dockerfile)?.[1];
      expect(npmVersion, 'Docker builder npm pin').toBeDefined();
      for (const [manifestName, lockName] of manifests) {
        const manifestPath = join(repoRoot, manifestName);
        if (!existsSync(manifestPath)) continue;
        const dir = mkdtempSync(join(tmpdir(), 'metapi-npm-ci-'));
        for (const file of [manifestName, lockName]) {
          const target = join(dir, file);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, readFileSync(join(repoRoot, file)));
        }
        const workdir = dirname(manifestName);
        const result = spawnSync(
          'docker',
          ['run', '--rm', '-v', `${dir}:/w`, '-w', `/w/${workdir}`, 'node:22-bookworm-slim', 'sh', '-c',
            `npm install --global npm@${npmVersion} --no-audit --no-fund && npm ci --ignore-scripts --no-audit --no-fund`],
          { encoding: 'utf8', timeout: 9 * 60_000 },
        );
        const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
        expect(output, `${manifestName} install output`).not.toContain('from lock file');
        expect(result.status, `${manifestName}: ${output.slice(-500)}`).toBe(0);
      }
    },
    15 * 60_000,
  );
});
