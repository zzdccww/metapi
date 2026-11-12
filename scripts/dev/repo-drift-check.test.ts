import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatRepoDriftReport, runRepoDriftCheck } from './repo-drift-check.js';

function writeWorkspaceFiles(root: string, files: Record<string, string>): void {
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = join(root, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contents);
  }
}

describe('repo drift check', () => {
  it('separates new violations from tracked debt', () => {
    const root = mkdtempSync(join(tmpdir(), 'metapi-repo-drift-'));
    writeWorkspaceFiles(root, {
      'src/server/transformers/openai/responses/routeCompatibility.ts': "import type { EndpointAttemptContext } from '../../../routes/proxy/endpointFlow.js';\n",
      'src/server/proxy-core/surfaces/chatSurface.ts': 'const payload = await upstream.text();\n',
      'src/server/proxy-core/surfaces/sharedSurface.ts': "import { dispatchRuntimeRequest } from '../../routes/proxy/runtimeExecutor.js';\n",
      'src/web/pages/Accounts.tsx': "import { TokensPanel } from './Tokens.js';\n",
      'src/web/pages/Tokens.tsx': 'export const TokensPanel = () => null;\n',
    });

    const report = runRepoDriftCheck({ root });

    expect(report.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: 'proxy-surface-body-read',
        file: 'src/server/proxy-core/surfaces/chatSurface.ts',
      }),
      expect.objectContaining({
        ruleId: 'transformers-route-blind',
        file: 'src/server/transformers/openai/responses/routeCompatibility.ts',
      }),
    ]));
    expect(report.trackedDebt).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: 'proxy-core-routes-proxy-import',
        file: 'src/server/proxy-core/surfaces/sharedSurface.ts',
      }),
      expect.objectContaining({
        ruleId: 'web-page-to-page-import',
        file: 'src/web/pages/Accounts.tsx',
      }),
    ]));
  });

  it('flags node:vm imports in server source but not in tests or same-named helpers', () => {
    const root = mkdtempSync(join(tmpdir(), 'metapi-repo-drift-vm-'));
    writeWorkspaceFiles(root, {
      'src/server/services/platforms/staticImport.ts': "import { createContext, runInContext } from 'node:vm';\n",
      'src/server/services/platforms/dynamicImport.ts': "const vm = await import('node:vm');\n",
      'src/server/services/platforms/bareRequire.ts': "const vm = require('vm');\n",
      // Tests may import or mock node:vm to prove production code never reaches it.
      'src/server/services/platforms/mocked.test.ts': "import { createContext } from 'node:vm';\nvi.mock('node:vm', () => ({}));\n",
      // Unrelated helpers that merely share the vm API's function names.
      'src/server/transformers/openai/chat/streamBridge.ts': 'export function createContext() { return {}; }\nexport function runInContext() { return null; }\n',
    });

    const report = runRepoDriftCheck({ root });
    const vmFindings = report.violations.filter((finding) => finding.ruleId === 'no-node-vm-execution');

    expect(vmFindings.map((finding) => finding.file).sort()).toEqual([
      'src/server/services/platforms/bareRequire.ts',
      'src/server/services/platforms/dynamicImport.ts',
      'src/server/services/platforms/staticImport.ts',
    ]);
    expect(report.trackedDebt.filter((finding) => finding.ruleId === 'no-node-vm-execution')).toEqual([]);
  });

  it('keeps the current repository within the first-wave ratchet', () => {
    const report = runRepoDriftCheck({ root: process.cwd() });
    expect(report.violations).toEqual([]);
    expect(report.trackedDebt).toEqual(expect.any(Array));
  });

  it('can render markdown reports for scheduled cleanup jobs', () => {
    const report = runRepoDriftCheck({ root: process.cwd() });
    const markdown = formatRepoDriftReport(report, 'markdown');

    expect(markdown).toContain('# Repo Drift Report');
    expect(markdown).toContain('## Violations');
    expect(markdown).toContain('## Tracked Debt');
  });
});
