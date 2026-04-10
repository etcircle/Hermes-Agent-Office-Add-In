import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStoredSessionToken, getStoredSessionToken, setStoredSessionToken } from '../auth';
import { HermesBackendClient } from '../backend-client';

describe('HermesBackendClient', () => {
  beforeEach(() => {
    localStorage.clear();
    clearStoredSessionToken();
    vi.restoreAllMocks();
  });

  it('logs in through the local bridge auth endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'session-1', expiresAt: '2026-04-11T00:00:00.000Z' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HermesBackendClient({ baseUrl: 'http://localhost:3300' });
    const result = await client.login('secret-passphrase');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3300/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.token).toBe('session-1');
    expect(localStorage.getItem('hermes_agent_office_session_token')).toBe('session-1');
  });

  it('returns the current bridge session status through /auth/session', async () => {
    setStoredSessionToken('bridge-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, expiresAt: '2026-04-11T01:00:00.000Z' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HermesBackendClient({ baseUrl: 'http://localhost:3300' });
    const result = await client.getBridgeSession();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3300/auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers),
      }),
    );
    expect(result).toEqual({ authenticated: true, expiresAt: '2026-04-11T01:00:00.000Z' });
  });

  it('logs out through the bridge and clears the cached session token', async () => {
    setStoredSessionToken('bridge-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HermesBackendClient({ baseUrl: 'http://localhost:3300' });
    await client.logout();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3300/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }),
    );
    expect(getStoredSessionToken()).toBeNull();
  });

  it('posts chat requests to /api/v1/responses with the bridge session token', async () => {
    setStoredSessionToken('bridge-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'Hello from Hermes' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HermesBackendClient({ baseUrl: 'http://localhost:3300' });
    await client.chat('Write a short intro');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3300/api/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }),
    );

    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = requestInit.headers as Headers;
    expect(headers.get('X-Session-Token')).toBe('bridge-token');
    expect(JSON.parse(String(requestInit.body))).toEqual({
      input: 'Write a short intro',
    });
  });

  it('clears the cached session token when the bridge reports an expired local session', async () => {
    setStoredSessionToken('bridge-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'x-hermes-office-auth': 'bridge-session-expired' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HermesBackendClient({ baseUrl: 'http://localhost:3300' });

    await expect(client.chat('Write a short intro')).rejects.toThrow(/bridge session expired/i);
    expect(getStoredSessionToken()).toBeNull();
  });

  it('does not clear the cached session token for upstream 401 responses without the bridge auth marker', async () => {
    setStoredSessionToken('bridge-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HermesBackendClient({ baseUrl: 'http://localhost:3300' });

    await expect(client.chat('Write a short intro')).rejects.toThrow(/chat request failed: 401/i);
    expect(getStoredSessionToken()).toBe('bridge-token');
  });
});
