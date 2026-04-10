import { buildAuthHeaders, clearStoredSessionToken, setStoredSessionToken } from './auth';
import type {
  BridgeLoginResult,
  BridgeSessionStatus,
  ChatCapability,
  ChatResponse,
  ChatStreamChunk,
  SessionCapability,
  StreamingChatCapability,
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

function getResponseText(result: ChatResponse): string {
  return result.output_text || JSON.stringify(result.output ?? {}, null, 2);
}

function isBridgeSessionExpired(response: Response): boolean {
  return response.status === 401 && response.headers.get('x-hermes-office-auth') === 'bridge-session-expired';
}

function assertBridgeAuth(response: Response): void {
  if (isBridgeSessionExpired(response)) {
    clearStoredSessionToken();
    throw new BridgeSessionExpiredError();
  }

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }
}

function parseSsePayload(data: string): unknown {
  if (data === '[DONE]') {
    return { type: 'done' };
  }

  try {
    return JSON.parse(data) as unknown;
  } catch {
    return data;
  }
}

async function* iterateServerSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let boundaryIndex = buffer.indexOf('\n\n');
      while (boundaryIndex !== -1) {
        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        boundaryIndex = buffer.indexOf('\n\n');

        const lines = rawEvent.replace(/\r\n/g, '\n').split('\n');
        const data = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n');

        if (data) {
          yield parseSsePayload(data);
        }
      }

      if (done) {
        const trailing = buffer.trim();
        if (trailing) {
          const lines = trailing.replace(/\r\n/g, '\n').split('\n');
          const data = lines
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');
          if (data) {
            yield parseSsePayload(data);
          }
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function extractStreamDelta(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidate = payload as {
    type?: string;
    delta?: string;
    output_text?: string;
    outputText?: string;
    text?: string;
  };

  if (typeof candidate.delta === 'string') {
    return candidate.delta;
  }

  if (candidate.type === 'response.output_text.delta' && typeof candidate.delta === 'string') {
    return candidate.delta;
  }

  if ((candidate.type === 'output_text.delta' || candidate.type === 'text.delta') && typeof candidate.text === 'string') {
    return candidate.text;
  }

  return '';
}

function getDonePayloadOutput(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidate = payload as { output_text?: string; outputText?: string };
  return typeof candidate.output_text === 'string' ? candidate.output_text : candidate.outputText ?? '';
}

function isDonePayload(payload: unknown): boolean {
  if (typeof payload === 'string') {
    return false;
  }

  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as { type?: string; done?: boolean };
  return candidate.done === true || candidate.type === 'done' || candidate.type === 'response.completed';
}

export class HermesBackendClient implements ChatCapability, SessionCapability, StreamingChatCapability {
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

    if (isBridgeSessionExpired(response)) {
      clearStoredSessionToken();
      throw new BridgeSessionExpiredError();
    }

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    return (await response.json()) as ChatResponse;
  }

  async *streamChat(input: string): AsyncGenerator<ChatStreamChunk> {
    const response = await fetch(`${this.getBaseUrl()}/api/v1/responses`, {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
      }),
      body: JSON.stringify({ input }),
    });

    assertBridgeAuth(response);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream') || !response.body) {
      const payload = (await response.json()) as ChatResponse;
      const outputText = getResponseText(payload);
      if (outputText) {
        yield { type: 'delta', delta: outputText, raw: payload };
      }
      yield { type: 'done', outputText, raw: payload };
      return;
    }

    let finalText = '';
    for await (const payload of iterateServerSentEvents(response.body)) {
      const delta = extractStreamDelta(payload);
      if (delta) {
        finalText += delta;
        yield { type: 'delta', delta, raw: payload };
      }

      if (isDonePayload(payload)) {
        const outputText = getDonePayloadOutput(payload) || finalText;
        if (outputText && outputText !== finalText) {
          const missingText = outputText.startsWith(finalText) ? outputText.slice(finalText.length) : outputText;
          if (missingText) {
            finalText += missingText;
            yield { type: 'delta', delta: missingText, raw: payload };
          }
        }

        yield { type: 'done', outputText: finalText, raw: payload };
        return;
      }
    }

    yield { type: 'done', outputText: finalText };
  }
}
