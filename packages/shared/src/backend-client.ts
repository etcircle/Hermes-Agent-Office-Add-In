import { buildAuthHeaders, clearStoredSessionToken, setStoredSessionToken } from './auth';
import type {
  BridgeLoginResult,
  BridgeSessionStatus,
  ChatCapability,
  ChatResponse,
  SessionCapability,
} from './contracts/capabilities';

export interface HermesBackendClientConfig {
  baseUrl?: string;
}

export type BridgeLoginResponse = BridgeLoginResult;

export class BridgeSessionExpiredError extends Error {
  constructor(message = 'Bridge session expired. Please unlock the add-in again.') {
    super(message);
    this.name = 'BridgeSessionExpiredError';
  }
}

export class HermesBackendClient implements ChatCapability, SessionCapability {
  constructor(private readonly config: HermesBackendClientConfig = {}) {}

  getBaseUrl(): string {
    return this.config.baseUrl || '';
  }

  async login(passphrase: string): Promise<BridgeLoginResponse> {
    const response = await fetch(`${this.getBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ passphrase }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = (await response.json()) as BridgeLoginResponse;
    setStoredSessionToken(data.token);
    return data;
  }

  async getBridgeSession(): Promise<BridgeSessionStatus> {
    const response = await fetch(`${this.getBaseUrl()}/auth/session`, {
      method: 'GET',
      headers: buildAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Session check failed: ${response.status}`);
    }

    return (await response.json()) as BridgeSessionStatus;
  }

  async logout(): Promise<void> {
    const response = await fetch(`${this.getBaseUrl()}/auth/logout`, {
      method: 'POST',
      headers: buildAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Logout failed: ${response.status}`);
    }

    clearStoredSessionToken();
  }

  async chat(input: string): Promise<ChatResponse> {
    const response = await fetch(`${this.getBaseUrl()}/api/v1/responses`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ input }),
    });

    if (response.status === 401 && response.headers.get('x-hermes-office-auth') === 'bridge-session-expired') {
      clearStoredSessionToken();
      throw new BridgeSessionExpiredError();
    }

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    return (await response.json()) as ChatResponse;
  }
}
