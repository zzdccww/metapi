import { describe, expect, it } from 'vitest';
import { assertSafeAdminCredentials, DEFAULT_ADMIN_TOKEN, parseAdminBearerToken, timingSafeTokenEqual } from './adminCredentials.js';

describe('administrator credentials', () => {
  it.each(['Bearer private-token', 'bearer private-token', 'BEARER  private-token'])('accepts valid scheme %s', (header) => {
    expect(parseAdminBearerToken(header)).toBe('private-token');
  });
  it.each(['private-token', 'Basic private-token', 'xBearer private-token', 'Bearer', 'Bearer ', 'Bearer\tprivate-token',
    'Bearer private token', 'Bearer private-token,other', 'Bearer Bearer private-token', ' Bearer private-token', 'Bearer private-token\n'])
    ('rejects malformed header %j', (header) => { expect(parseAdminBearerToken(header)).toBeNull(); });
  it('compares exact values safely for different lengths and UTF-16 values', () => {
    for (const value of ['', 'token', '令牌', '\ud800']) expect(timingSafeTokenEqual(value, value)).toBe(true);
    for (const value of ['', 't', 'token-plus', 'tokeN']) expect(timingSafeTokenEqual(value, 'token')).toBe(false);
    expect(timingSafeTokenEqual('é', 'aa')).toBe(false);
    expect(timingSafeTokenEqual('\ud800', '\ud801')).toBe(false);
    expect(timingSafeTokenEqual('old-token', 'new-token')).toBe(false);
  });
  it.each(['127.0.0.1', '::1'])('allows default token only for local debug/desktop at %s', (listenHost) => {
    expect(() => assertSafeAdminCredentials({ authToken: DEFAULT_ADMIN_TOKEN, listenHost, isDesktop: false, nodeEnv: 'development' })).not.toThrow();
    expect(() => assertSafeAdminCredentials({ authToken: DEFAULT_ADMIN_TOKEN, listenHost, isDesktop: true, nodeEnv: 'production' })).not.toThrow();
    expect(() => assertSafeAdminCredentials({ authToken: DEFAULT_ADMIN_TOKEN, listenHost, isDesktop: false, nodeEnv: 'production' })).toThrow('non-default');
  });
  it.each(['0.0.0.0', '::', 'localhost', '192.0.2.7'])('rejects default credentials on non-loopback bind %s', (listenHost) => {
    for (const isDesktop of [false, true]) {
      expect(() => assertSafeAdminCredentials({ authToken: DEFAULT_ADMIN_TOKEN, listenHost, isDesktop, nodeEnv: 'development' })).toThrow('non-default');
    }
  });
  it('accepts hydrated private credentials and rejects blank credentials', () => {
    const config = { authToken: 'saved-private-token', listenHost: '0.0.0.0', isDesktop: false, nodeEnv: 'production' };
    expect(() => assertSafeAdminCredentials(config)).not.toThrow();
    for (const authToken of ['', '   ']) expect(() => assertSafeAdminCredentials({ ...config, authToken })).toThrow('blank');
    for (const authToken of ['private token', 'private,token']) expect(() => assertSafeAdminCredentials({ ...config, authToken })).toThrow('whitespace or commas');
  });
});
