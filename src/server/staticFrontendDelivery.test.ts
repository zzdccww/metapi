import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { frontendEntryForPath, frontendRedirectForPath } from './frontendEntry.js';
import { setFrontendCacheHeaders } from './staticFrontendCache.js';

const webDir = mkdtempSync(join(tmpdir(), 'metapi-static-'));
writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>root</title>');
mkdirSync(join(webDir, 'assets'));
writeFileSync(join(webDir, 'assets', 'index-abc123.js'), 'export default 1;');

describe('static frontend delivery', () => {
  const app = Fastify();

  beforeAll(async () => {
    await app.register(fastifyStatic, {
      root: webDir,
      prefix: '/',
      wildcard: false,
      setHeaders: setFrontendCacheHeaders,
    });
    app.setNotFoundHandler(async (request, reply) => {
      const destination = frontendRedirectForPath(request.url);
      if (destination) return reply.header('Cache-Control', 'no-cache').redirect(destination, 302);
      const entry = frontendEntryForPath(request.url);
      if (entry) return reply.sendFile(entry);
      return reply.code(404).send({ error: 'Not found' });
    });
  });

  afterAll(async () => {
    await app.close();
    rmSync(webDir, { recursive: true, force: true });
  });

  it('serves the entry document with an explicit cache policy instead of throwing', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('root');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it.each(['/assets/index-abc123.js'])(
    'serves hashed asset %s with immutable caching', async (url) => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it.each(['/accounts', '/routes', '/settings?tab=general'])(
    'serves the original shell for deep link %s without caching the entry', async (url) => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<title>root</title>');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it.each([
    ['/legacy/accounts?segment=tokens', '/accounts?segment=tokens'],
    ['/app/dashboard', '/'], ['/app/import-export', '/settings/import-export'],
    ['/app/notifications?channel=smtp', '/settings/notify?channel=smtp'],
    ['/app/proxy-logs?page=2', '/logs?page=2'],
  ])('redirects bookmark %s to the original page', async (url, destination) => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(destination);
    expect(response.headers['cache-control']).toBe('no-cache');
    const page = await app.inject({ method: 'GET', url: destination });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('<title>root</title>');
  });

  it.each(['/api/missing', '/v1/missing', '/assets/missing.js', '/legacy/assets/missing.js'])(
    'does not serve an HTML shell for reserved path %s', async (url) => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Not found' });
  });
});
