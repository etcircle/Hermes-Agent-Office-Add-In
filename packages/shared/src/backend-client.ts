import { buildAuthHeaders, setStoredSessionToken } from './auth';

export interface HermesBackendClientConfig {
  baseUrl?: string;
}

export interface BridgeLoginResponse {
  token: string;
  expiresAt: string;
}

export interface ChatResponse {
  output_text?: string;
  output?: unknown;
}

export class HermesBackendClient {
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

  async chat(input: string): Promise<ChatResponse> {
    const response = await fetch(`${this.getBaseUrl()}/api/v1/responses`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    return (await response.json()) as ChatResponse;
  }
}
