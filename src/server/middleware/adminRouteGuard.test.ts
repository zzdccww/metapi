import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfig, buildFastifyOptions, config } from '../config.js';
import { registerDesktopRoutes } from '../desktop.js';
import { registerAdminRouteGuard } from './adminRouteGuard.js';
import { proxyAuthMiddleware } from './auth.js';
import { resetRequestRateLimitStore } from './requestRateLimit.js';

const { authorizeDownstreamTokenMock } = vi.hoisted(() => ({
  authorizeDownstreamTokenMock: vi.fn(),
}));

vi.mock('../services/downstreamApiKeyService.js', () => ({
  authorizeDownstreamToken: authorizeDownstreamTokenMock,
  consumeManagedKeyRequest: vi.fn(),
}));

const ADMIN_TOKEN = 'admin-route-guard-test-token';
const adminHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };
const protectedPaths = [
  '/api/protected',
  '/%61pi/protected',
  '/a%70i/protected',
  '/ap%69/protected',
  '/%61%70%69/protected',
  '/%61%70%69/%70rotected?source=test',
];
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const protectedRequests = methods.flatMap((method) => protectedPaths.map((url) => ({ method, url })));

describe('production management route guard', () => {
  let app: FastifyInstance | undefined;
  const originalConfig = {
    authToken: config.authToken,
    adminIpAllowlist: config.adminIpAllowlist,
    authenticatedRateLimitMax: config.authenticatedRateLimitMax,
    requestRateLimitWindowMs: config.requestRateLimitWindowMs,
  };

  beforeEach(() => {
    config.authToken = ADMIN_TOKEN;
    config.adminIpAllowlist = [];
    config.authenticatedRateLimitMax = 100;
    config.requestRateLimitWindowMs = 60_000;
    authorizeDownstreamTokenMock.mockReset();
    resetRequestRateLimitStore();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    Object.assign(config, originalConfig);
    vi.restoreAllMocks();
    resetRequestRateLimitStore();
  });

  function buildProtectedApp() {
    app = Fastify();
    registerAdminRouteGuard(app);
    const handler = vi.fn(async () => ({ ok: true }));
    app.route({ method: [...methods], url: '/api/protected', handler });
    return { server: app, handler };
  }

  it.each(protectedRequests)('enforces credentials and IP policy for $method $url', async ({ method, url }) => {
    const { server, handler } = buildProtectedApp();

    const missing = await server.inject({ method, url });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: 'Missing Authorization header' });
    expect(handler).not.toHaveBeenCalled();

    const wrong = await server.inject({ method, url, headers: { authorization: 'Bearer wrong-admin-token' } });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toEqual({ error: 'Invalid token' });
    expect(handler).not.toHaveBeenCalled();

    config.adminIpAllowlist = ['198.51.100.0/24'];
    const deniedIp = await server.inject({ method, url, headers: adminHeaders, remoteAddress: '203.0.113.5' });
    expect(deniedIp.statusCode).toBe(403);
    expect(deniedIp.json()).toEqual({ error: 'IP not allowed' });
    expect(handler).not.toHaveBeenCalled();

    const allowed = await server.inject({ method, url, headers: adminHeaders, remoteAddress: '198.51.100.7' });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('protects the automatically registered encoded HEAD route', async () => {
    const { server, handler } = buildProtectedApp();
    const url = '/%61pi/protected';

    const missing = await server.inject({ method: 'HEAD', url });
    expect(missing.statusCode).toBe(401);
    const wrong = await server.inject({ method: 'HEAD', url, headers: { authorization: 'Bearer wrong' } });
    expect(wrong.statusCode).toBe(403);
    config.adminIpAllowlist = ['198.51.100.7'];
    const deniedIp = await server.inject({ method: 'HEAD', url, headers: adminHeaders });
    expect(deniedIp.statusCode).toBe(403);
    expect(handler).not.toHaveBeenCalled();

    const accepted = await server.inject({ method: 'HEAD', url, headers: adminHeaders, remoteAddress: '198.51.100.7' });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.body).toBe('');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each(['Bearer wrong', ADMIN_TOKEN, `Basic ${ADMIN_TOKEN}`, `prefixBearer ${ADMIN_TOKEN}`, 'Bearer ', `Bearer ${ADMIN_TOKEN},other`])
    ('rejects incorrect or malformed administrator credential %s', async (authorization) => {
      const { server, handler } = buildProtectedApp();
      const response = await server.inject({ url: '/%61pi/protected', headers: { authorization } });
      expect(response.statusCode).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

  it.each([
    { proxies: '', peer: '127.0.0.1', forwarded: '198.51.100.7', status: 403 },
    { proxies: '10.0.0.8', peer: '127.0.0.1', forwarded: '198.51.100.7', status: 403 },
    { proxies: '10.0.0.8', peer: '10.0.0.8', forwarded: '198.51.100.7', status: 200 },
    { proxies: '10.0.0.8', peer: '10.0.0.8', forwarded: '198.51.100.7, 203.0.113.5', status: 403 },
    { proxies: '10.0.0.0/24', peer: '10.0.0.8', forwarded: '198.51.100.7, 10.0.0.9', status: 200 },
    { proxies: '10.0.0.0/24', peer: '10.0.0.8', forwarded: '198.51.100.7, 192.0.2.9', status: 403 },
    { proxies: '2001:db8::/64', peer: '2001:db8::8', forwarded: '198.51.100.7', status: 200 },
  ])('uses the declared proxy chain for $peer with $forwarded', async ({ proxies, peer, forwarded, status }) => {
    config.adminIpAllowlist = ['198.51.100.7'];
    app = Fastify({ ...buildFastifyOptions(buildConfig({ TRUSTED_PROXY_IPS: proxies })), logger: false });
    registerAdminRouteGuard(app);
    const handler = vi.fn(async () => ({ ok: true }));
    app.get('/api/protected', handler);
    const response = await app.inject({ url: '/%61pi/protected', remoteAddress: peer,
      headers: { ...adminHeaders, 'x-forwarded-for': forwarded } });
    expect(response.statusCode).toBe(status);
    expect(handler).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  });

  it.each([
    '/api/settings/auth/info',
    '/%61pi/settings/auth/info',
    '/api/settings/backup/export?type=all',
    '/%61pi/settings/backup/export?type=all',
  ])('protects the reported settings route %s through nested plugins', async (url) => {
    app = Fastify();
    registerAdminRouteGuard(app);
    const handler = vi.fn(async () => ({ synthetic: true }));
    await app.register(async (apiApp) => {
      await apiApp.register(async (settingsApp) => {
        settingsApp.get('/auth/info', handler);
        settingsApp.get('/backup/export', handler);
      }, { prefix: '/settings' });
    }, { prefix: '/api' });

    const missing = await app.inject({ method: 'GET', url });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: 'Missing Authorization header' });
    expect(handler).not.toHaveBeenCalled();

    const accepted = await app.inject({ method: 'GET', url, headers: adminHeaders });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ synthetic: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('shares the administrator bucket across encodings, methods and client addresses exactly once', async () => {
    config.authenticatedRateLimitMax = 2;
    config.requestRateLimitWindowMs = 1_000;
    let nowMs = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    const { server, handler } = buildProtectedApp();

    const first = await server.inject({ method: 'GET', url: '/api/protected', headers: adminHeaders });
    const second = await server.inject({
      method: 'POST', url: '/%61pi/protected', remoteAddress: '198.51.100.7',
      headers: { ...adminHeaders, 'x-forwarded-for': '203.0.113.8' },
    });
    const blocked = await server.inject({ method: 'PUT', url: '/a%70i/protected', headers: adminHeaders });
    const stillBlocked = await server.inject({ method: 'DELETE', url: '/api/protected', headers: adminHeaders });

    expect([first.statusCode, second.statusCode, blocked.statusCode, stillBlocked.statusCode]).toEqual([200, 200, 429, 429]);
    expect(blocked.headers['retry-after']).toBe('1');
    expect(blocked.json()).toEqual({ success: false, message: '请求过于频繁，请稍后再试' });
    expect(handler).toHaveBeenCalledTimes(2);

    nowMs += 1_000;
    const afterWindow = await server.inject({ method: 'GET', url: '/ap%69/protected', headers: adminHeaders });
    expect(afterWindow.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('does not consume the authenticated bucket for rejected credentials or IPs', async () => {
    config.authenticatedRateLimitMax = 1;
    const { server, handler } = buildProtectedApp();
    const missing = await server.inject({ method: 'GET', url: '/%61pi/protected' });
    const wrong = await server.inject({ method: 'POST', url: '/a%70i/protected', headers: { authorization: 'Bearer wrong' } });
    config.adminIpAllowlist = ['198.51.100.7'];
    const deniedIp = await server.inject({ method: 'PUT', url: '/ap%69/protected', headers: adminHeaders });

    expect([missing.statusCode, wrong.statusCode, deniedIp.statusCode]).toEqual([401, 403, 403]);
    expect(handler).not.toHaveBeenCalled();

    config.adminIpAllowlist = [];
    const accepted = await server.inject({ method: 'GET', url: '/api/protected', headers: adminHeaders });
    const blocked = await server.inject({ method: 'DELETE', url: '/%61%70%69/protected', headers: adminHeaders });
    expect([accepted.statusCode, blocked.statusCode]).toEqual([200, 429]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/api/desktop/health',
    '/api/desktop/health?source=test',
    '/%61pi/%64esktop/%68ealth?source=test',
    '/api/oauth/callback/test-provider',
    '/api/oauth/callback/test-provider?code=test&state=test',
    '/a%70i/%6Fauth/%63allback/test-provider?code=test&state=test',
  ])('keeps the matched public route %s exempt from administrator auth and limits', async (url) => {
    config.authenticatedRateLimitMax = 1;
    const { server } = buildProtectedApp();
    await server.register(registerDesktopRoutes);
    server.get('/api/oauth/callback/:provider', async () => ({ ok: true }));
    expect((await server.inject({ method: 'GET', url: '/api/protected', headers: adminHeaders })).statusCode).toBe(200);
    expect((await server.inject({ method: 'GET', url: '/api/protected', headers: adminHeaders })).statusCode).toBe(429);
    config.adminIpAllowlist = ['203.0.113.99'];

    const publicResponse = await server.inject({ method: 'GET', url });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json()).toEqual({ ok: true });
  });

  it.each(['/v1/models', '/%761/models'])('preserves independent proxy authentication for %s', async (url) => {
    config.authenticatedRateLimitMax = 1;
    config.adminIpAllowlist = ['203.0.113.99'];
    authorizeDownstreamTokenMock.mockImplementation(async (token: string) => token === 'proxy-test-token'
      ? { ok: true, source: 'global', token, key: null, policy: {} }
      : { ok: false, statusCode: 403, error: 'Invalid proxy token' });
    const { server, handler: adminHandler } = buildProtectedApp();
    const proxyHandler = vi.fn(async () => ({ proxy: true }));
    await server.register(async (proxyApp) => {
      proxyApp.addHook('onRequest', proxyAuthMiddleware);
      proxyApp.get('/v1/models', proxyHandler);
    });

    const missing = await server.inject({ method: 'GET', url });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: 'Missing Authorization, x-api-key, x-goog-api-key, or key query parameter' });
    const adminToken = await server.inject({ method: 'GET', url, headers: adminHeaders });
    expect(adminToken.statusCode).toBe(403);
    expect(adminToken.json()).toEqual({ error: 'Invalid proxy token' });
    expect(proxyHandler).not.toHaveBeenCalled();

    const proxyHeaders = { authorization: 'Bearer proxy-test-token' };
    for (let i = 0; i < 2; i += 1) {
      const accepted = await server.inject({ method: 'GET', url, headers: proxyHeaders });
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toEqual({ proxy: true });
    }
    expect(proxyHandler).toHaveBeenCalledTimes(2);

    config.adminIpAllowlist = [];
    expect((await server.inject({ method: 'GET', url: '/api/protected', headers: proxyHeaders })).statusCode).toBe(403);
    expect((await server.inject({ method: 'GET', url: '/api/protected', headers: adminHeaders })).statusCode).toBe(200);
    expect(adminHandler).toHaveBeenCalledTimes(1);
  });

  it('preserves unknown API rejection and not-found handling without a matched route identity', async () => {
    const { server, handler } = buildProtectedApp();
    const missing = await server.inject({ method: 'GET', url: '/api/missing?source=test' });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: 'Missing Authorization header' });
    const wrong = await server.inject({ method: 'GET', url: '/api/missing', headers: { authorization: 'Bearer wrong' } });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toEqual({ error: 'Invalid token' });
    expect((await server.inject({ method: 'GET', url: '/api/missing', headers: adminHeaders })).statusCode).toBe(404);
    expect((await server.inject({ method: 'GET', url: '/%61pi/missing' })).statusCode).toBe(404);
    expect((await server.inject({ method: 'GET', url: '/api/desktop/health-extra' })).statusCode).toBe(401);
    expect((await server.inject({ method: 'GET', url: '/api/oauth/callbackish/provider' })).statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});
