import { describe, expect, it } from 'vitest';
import { isIpAllowed } from './auth.js';
import { normalizeClientIp } from '../shared/clientIp.js';

describe('auth middleware IP helpers', () => {
  it('normalizes the framework-resolved address without parsing forwarding data', () => {
    expect(normalizeClientIp('::ffff:10.0.0.1')).toBe('10.0.0.1');
    expect(normalizeClientIp('::1')).toBe('127.0.0.1');
    expect(normalizeClientIp(undefined)).toBe('');
  });

  it('allows request when allowlist is empty', () => {
    expect(isIpAllowed('203.0.113.8', [])).toBe(true);
  });

  it('rejects non-allowlisted IP when allowlist is configured', () => {
    expect(isIpAllowed('203.0.113.8', ['203.0.113.9'])).toBe(false);
    expect(isIpAllowed('203.0.113.9', ['203.0.113.9'])).toBe(true);
  });

  it('matches ipv4 CIDR ranges in the allowlist', () => {
    expect(isIpAllowed('8.8.8.8', ['8.8.8.0/24'])).toBe(true);
    expect(isIpAllowed('8.8.9.8', ['8.8.8.0/24'])).toBe(false);
    expect(isIpAllowed('8.8.8.8', ['8.8.0.0/16'])).toBe(true);
  });

  it('ignores malformed CIDR entries instead of matching unexpectedly', () => {
    expect(isIpAllowed('8.8.8.8', ['8.8.8.0/99'])).toBe(false);
    expect(isIpAllowed('8.8.8.8', ['not-an-ip/24'])).toBe(false);
  });
});
