import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getStoredSessionToken,
  hasStoredSessionToken,
  setStoredSessionToken,
  clearStoredSessionToken,
  buildAuthHeaders,
} from '../auth';

describe('shared auth storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves the session token', () => {
    setStoredSessionToken('abc123');

    expect(getStoredSessionToken()).toBe('abc123');
    expect(hasStoredSessionToken()).toBe(true);
    expect(localStorage.getItem('hermes_agent_office_session_token')).toBe('abc123');
  });

  it('clears the session token', () => {
    setStoredSessionToken('abc123');

    clearStoredSessionToken();

    expect(getStoredSessionToken()).toBeNull();
    expect(localStorage.getItem('hermes_agent_office_session_token')).toBeNull();
  });

  it('builds auth headers with x-session-token when a token exists', () => {
    setStoredSessionToken('bridge-token');

    const headers = buildAuthHeaders({ 'Content-Type': 'application/json' });

    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Session-Token')).toBe('bridge-token');
  });

  it('does not inject a fake session header when no token exists', () => {
    const headers = buildAuthHeaders();

    expect(headers.has('X-Session-Token')).toBe(false);
  });
});
