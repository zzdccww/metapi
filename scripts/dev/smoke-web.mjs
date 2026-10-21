import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
const web = resolve(root, 'dist/web');
assert.ok(existsSync(resolve(web, 'index.html')), 'Run npm run build:web first');
assert.equal(existsSync(resolve(web, 'legacy/index.html')), false, 'Build must contain one interface');
const site = { id: 1, name: 'Fixture Site', url: 'https://fixture.invalid', platform: 'new-api', status: 'active', globalWeight: 1 };
const account = { id: 1, siteId: 1, username: 'fixture-user', accessToken: 'fixture-session', credentialMode: 'session', status: 'active', balance: 10, site };
const routeSummary = { id: 1, modelPattern: 'gpt-4o-mini', displayName: 'gpt-4o-mini', routingStrategy: 'weighted', enabled: true, channelCount: 1, enabledChannelCount: 1, siteNames: [site.name], decisionSnapshot: null };
const settings = { systemProxyUrl: '', checkinCron: '0 8 * * *', balanceRefreshCron: '0 * * * *', routingWeights: {}, adminIpAllowlist: [] };
const writes = [];
const json = (response, body, status = 200) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      let body = '';
      for await (const chunk of request) body += chunk;
      const payload = body ? JSON.parse(body) : undefined;
      if (request.method !== 'GET') writes.push({ path: url.pathname, method: request.method, payload });
      if (request.headers.authorization !== 'Bearer fixture-admin') return json(response, { error: 'Invalid fixture authorization' }, 403);
      if (url.pathname === '/api/sites/1' && payload) { Object.assign(site, payload); return json(response, site); }
      if (url.pathname === '/api/accounts/1' && payload) { Object.assign(account, payload); return json(response, { success: true }); }
      if (url.pathname === '/api/sites') return json(response, [site]);
      if (url.pathname.startsWith('/api/sites/1/')) return json(response, { models: [] });
      if (url.pathname === '/api/accounts') return json(response, { accounts: [account], sites: [site] });
      if (url.pathname === '/api/routes/summary' || url.pathname === '/api/routes/lite') return json(response, [routeSummary]);
      if (url.pathname === '/api/routes/1/channels') return json(response, []);
      if (url.pathname === '/api/routes/decision/batch' || url.pathname.includes('route-wide/batch')) return json(response, { decisions: {} });
      if (url.pathname === '/api/models/token-candidates') return json(response, { models: {}, endpointTypesByModel: {} });
      if (url.pathname === '/api/settings/runtime') { if (payload) Object.assign(settings, payload); return json(response, settings); }
      if (url.pathname === '/api/settings/auth/info') return json(response, { masked: 'fixture-****' });
      if (url.pathname === '/api/settings/database/runtime') return json(response, { active: { dialect: 'sqlite', connection: '(fixture sqlite)', ssl: false }, saved: null, restartRequired: false });
      if (url.pathname === '/api/settings/brand-list') return json(response, { brands: [] });
      if (url.pathname === '/api/events/count') return json(response, { count: 0 });
      if (url.pathname === '/api/events') return json(response, []);
      if (url.pathname === '/api/downstream-keys') return json(response, { items: [] });
      if (url.pathname === '/api/update-center/status') return json(response, { config: {}, runtime: {}, helper: { history: [] } });
      return json(response, {});
    }
    const pathname = decodeURIComponent(url.pathname);
    let filename = resolve(web, `.${pathname}`);
    if (!filename.startsWith(`${web}${sep}`) && filename !== web) return json(response, {}, 403);
    if (!extname(pathname)) filename = resolve(web, 'index.html');
    const bytes = await readFile(filename);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
    response.writeHead(200, { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    localStorage.setItem('metapi-auth-token', 'fixture-admin');
    localStorage.setItem('metapi-auth-expires-at', String(Date.now() + 3_600_000));
    localStorage.setItem('metapi_first_use_docs_reminder_seen_v1', '1');
    localStorage.setItem('app_language', 'zh-CN');
  });
  await context.route('https://**/*', route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`${base}/sites`);
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  await page.getByPlaceholder('站点名称', { exact: true }).fill('Fixture Site Edited');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('input[placeholder="站点名称"]'));
  assert.ok(writes.some(write => write.path === '/api/sites/1' && write.payload.name === 'Fixture Site Edited'), 'Site editor must persist its payload');
  await page.reload();
  await page.getByText('Fixture Site Edited', { exact: true }).first().waitFor();
  await page.locator('table input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: '批量禁用', exact: true }).waitFor();

  await page.goto(`${base}/accounts?segment=session`);
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  await page.getByPlaceholder('账号名称', { exact: true }).fill('fixture-user-edited');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('input[placeholder="账号名称"]'));
  assert.ok(writes.some(write => write.path === '/api/accounts/1' && write.payload.username === 'fixture-user-edited'), 'Account editor must persist its payload');

  await page.goto(`${base}/routes`);
  await page.getByPlaceholder('搜索模型路由...').fill('unmatched-fixture');
  await page.waitForFunction(() => document.querySelectorAll('.route-card-collapsed').length === 0);
  await page.getByPlaceholder('搜索模型路由...').fill('gpt-4o-mini');
  await page.locator('.route-card-collapsed').first().waitFor();
  await page.getByRole('button', { name: '批量操作', exact: true }).click();
  await page.getByRole('button', { name: '退出批量', exact: true }).waitFor();
  await page.getByRole('button', { name: '新建群组', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).last().click();

  await page.goto(`${base}/settings`);
  const proxyInput = page.getByPlaceholder('系统代理 URL（可选，如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080）');
  await proxyInput.fill('http://127.0.0.1:7890');
  await page.getByRole('button', { name: '保存系统代理', exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes('系统代理已保存'));
  assert.ok(writes.some(write => write.path === '/api/settings/runtime' && write.payload.systemProxyUrl === 'http://127.0.0.1:7890'), 'Settings must persist their payload');
  await page.reload();
  await proxyInput.waitFor();
  assert.equal(await proxyInput.inputValue(), 'http://127.0.0.1:7890');
  assert.equal(await page.evaluate(() => localStorage.getItem('auth_token')), null, 'Retired session should work without copying credentials');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await page.getByRole('link', { name: '站点管理', exact: true }).last().click();
  await page.waitForURL(`${base}/sites`);
  await page.getByText('Fixture Site Edited', { exact: true }).first().waitFor();
  assert.deepEqual(errors, [], 'Built interface must not throw browser errors');
  console.log('PASS: original built UI; retired-session login, site/account edits, reload, route search/group/batch controls, settings persistence and mobile navigation');
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
