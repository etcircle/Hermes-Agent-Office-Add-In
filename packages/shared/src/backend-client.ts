export interface HermesBackendClientConfig {
  baseUrl?: string;
}

export class HermesBackendClient {
  constructor(private readonly config: HermesBackendClientConfig = {}) {}

  getBaseUrl(): string {
    return this.config.baseUrl || '';
  }
}
