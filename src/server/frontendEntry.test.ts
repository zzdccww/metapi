import { describe, expect, it } from 'vitest';
import { frontendEntryForPath, frontendRedirectForPath } from './frontendEntry.js';

describe('original frontend delivery', () => {
  it.each(['/', '/accounts', '/settings/import-export', '/unknown-page'])(
    'serves the original SPA for %s', (url) => {
      expect(frontendEntryForPath(url)).toBe('index.html');
      expect(frontendRedirectForPath(url)).toBeNull();
    },
  );

  it.each([
    ['/legacy', '/'], ['/legacy/', '/'],
    ['/legacy/accounts?segment=tokens', '/accounts?segment=tokens'],
    ['/legacy/settings/notify?channel=smtp', '/settings/notify?channel=smtp'],
    ['/app/dashboard', '/'], ['/app/sites/', '/sites'],
    ['/app/proxy-logs?page=2', '/logs?page=2'], ['/app/checkins', '/checkin'],
    ['/app/import-export', '/settings/import-export'],
    ['/app/notifications', '/settings/notify'], ['/app/marketplace', '/models'],
  ])('maps bookmark %s to %s', (url, destination) => {
    expect(frontendRedirectForPath(url)).toBe(destination);
  });

  it.each(['/api', '/api/missing', '/v1', '/v1/models', '/monitor-proxy/missing', '/assets/missing.js', '/legacy/assets/missing.js'])(
    'preserves reserved path %s', (url) => {
      expect(frontendEntryForPath(url)).toBeNull();
      expect(frontendRedirectForPath(url)).toBeNull();
    },
  );

  it.each(['/legacy//evil.example', '/legacy/\\evil.example', '/legacy/settings?next=ok\r\nLocation: https://evil.example', 'https://evil.example/app/sites'])(
    'does not create an unsafe redirect for %s', (url) => {
      expect(frontendRedirectForPath(url)).toBeNull();
    },
  );
});
