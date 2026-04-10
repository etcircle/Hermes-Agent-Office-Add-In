export interface BridgeLoginResult {
  token: string;
  expiresAt: string;
}

export interface ChatResponse {
  output_text?: string;
  output?: unknown;
}

export interface BridgeSessionStatus {
  authenticated: boolean;
  expiresAt?: string;
}

export interface SessionCapability {
  login(passphrase: string): Promise<BridgeLoginResult>;
  getBridgeSession?(): Promise<BridgeSessionStatus>;
  logout?(): Promise<void>;
}

export interface ChatCapability {
  chat(input: string): Promise<ChatResponse>;
}
