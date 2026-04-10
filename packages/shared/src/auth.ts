const STORAGE_KEY = 'hermes_agent_office_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function hasStoredSessionToken(): boolean {
  return Boolean(getStoredSessionToken());
}

export function setStoredSessionToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore localStorage issues in unsupported environments
  }
}

export function clearStoredSessionToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore localStorage issues in unsupported environments
  }
}

export function buildAuthHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getStoredSessionToken();
  if (token) {
    headers.set('X-Session-Token', token);
  }
  return headers;
}
