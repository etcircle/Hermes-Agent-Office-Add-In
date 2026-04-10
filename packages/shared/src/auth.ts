const STORAGE_KEY = 'hermes_agent_office_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
