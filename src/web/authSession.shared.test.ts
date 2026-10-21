import { describe, expect, it } from 'vitest';

import { clearAuthSession, getAuthToken, hasValidAuthSession, persistAuthSession, AUTH_SESSION_DURATION_MS } from './authSession.js';

function memoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('administration session migration', () => {
  it('keeps the original UI session authoritative when both versions stored credentials', () => {
    const storage = memoryStorage({
      auth_token: 'legacy-token',
      auth_token_expires_at: String(1_000 + AUTH_SESSION_DURATION_MS),
      'metapi-auth-token': 'new-shell-token',
      'metapi-auth-expires-at': String(1_000 + AUTH_SESSION_DURATION_MS),
    });
    expect(getAuthToken(storage, 1_000)).toBe('legacy-token');
  });

  it('continues an original UI session without copying the token', () => {
    const storage = memoryStorage({
      auth_token: 'legacy-token',
      auth_token_expires_at: String(1_000 + AUTH_SESSION_DURATION_MS),
    });
    expect(getAuthToken(storage, 1_000)).toBe('legacy-token');
    expect(storage.getItem('metapi-auth-token')).toBeNull();
    expect(hasValidAuthSession(storage, 1_000)).toBe(true);
  });

  it('continues a retired UI session when no original UI session exists', () => {
    const storage = memoryStorage({
      'metapi-auth-token': 'new-shell-token',
      'metapi-auth-expires-at': String(1_000 + AUTH_SESSION_DURATION_MS),
    });
    expect(getAuthToken(storage, 1_000)).toBe('new-shell-token');
  });

  it('expires a retired UI session instead of adopting it past its deadline', () => {
    const storage = memoryStorage({
      'metapi-auth-token': 'new-shell-token',
      'metapi-auth-expires-at': String(1_000),
    });
    expect(getAuthToken(storage, 1_001)).toBeNull();
    expect(storage.getItem('metapi-auth-token')).toBeNull();
    expect(storage.getItem('metapi-auth-expires-at')).toBeNull();
    expect(hasValidAuthSession(storage, 1_001)).toBe(false);
  });

  it('clears both versions of session keys when invalidated', () => {
    const storage = memoryStorage({
      auth_token: 'legacy-token',
      auth_token_expires_at: '9999999999999',
      'metapi-auth-token': 'new-shell-token',
      'metapi-auth-expires-at': '9999999999999',
    });
    clearAuthSession(storage);
    expect(storage.getItem('auth_token')).toBeNull();
    expect(storage.getItem('auth_token_expires_at')).toBeNull();
    expect(storage.getItem('metapi-auth-token')).toBeNull();
    expect(storage.getItem('metapi-auth-expires-at')).toBeNull();
  });

  it('writes only original UI keys when persisting a new session', () => {
    const storage = memoryStorage();
    persistAuthSession(storage, ' issued-token ', AUTH_SESSION_DURATION_MS, 1_000);
    expect(storage.getItem('auth_token')).toBe('issued-token');
    expect(storage.getItem('auth_token_expires_at')).toBe(String(1_000 + AUTH_SESSION_DURATION_MS));
    expect(storage.getItem('metapi-auth-token')).toBeNull();
  });

  it('adopts an unmarked retired UI session with the standard twelve-hour lifetime exactly once', () => {
    const storage = memoryStorage({ 'metapi-auth-token': 'unmarked-token' });
    expect(getAuthToken(storage, 1_000)).toBe('unmarked-token');
    expect(Number(storage.getItem('metapi-auth-expires-at'))).toBe(1_000 + AUTH_SESSION_DURATION_MS);
    expect(getAuthToken(storage, 1_000 + AUTH_SESSION_DURATION_MS)).toBeNull();
  });
});
