import { useCallback, useEffect, useMemo, useState } from 'react';
import { BridgeSessionExpiredError } from '../backend-client';
import type {
  ChatCapability,
  ChatResponse,
  ChatStreamChunk,
  StreamingChatCapability,
} from '../contracts/capabilities';
import {
  createOfficeChatSession,
  formatOfficeChatSessionTitle,
  getOfficeChatSessionPreview,
  loadOfficeChatStore,
  saveOfficeChatStore,
  type OfficeChatMessage,
  type OfficeChatSession,
  type OfficeChatStoreState,
} from './session-store';

export interface ChatPromptRequest {
  prompt: string;
  displayInput?: string;
}

export interface UseOfficeChatOptions {
  client: ChatCapability | (ChatCapability & StreamingChatCapability);
  sessionStoreNamespace?: string;
  maxSessions?: number;
  onSessionExpired?: () => void;
}

export interface UseOfficeChatResult {
  sessions: OfficeChatSession[];
  activeSessionId: string;
  activeSession: OfficeChatSession;
  messages: OfficeChatMessage[];
  latestResponse: string;
  loading: boolean;
  error: string;
  input: string;
  setInput: (value: string) => void;
  createSession: () => void;
  selectSession: (sessionId: string) => void;
  generateResponse: (request: string | ChatPromptRequest) => Promise<void>;
}

function ensureStoreState(state: OfficeChatStoreState): OfficeChatStoreState {
  if (state.sessions.length) {
    return state;
  }

  const session = createOfficeChatSession();
  return {
    activeSessionId: session.id,
    sessions: [session],
  };
}

function resolveRequest(request: string | ChatPromptRequest): ChatPromptRequest {
  return typeof request === 'string' ? { prompt: request } : request;
}

function getResponseText(result: ChatResponse): string {
  return result.output_text || JSON.stringify(result.output ?? {}, null, 2);
}

function getActiveSession(state: OfficeChatStoreState): OfficeChatSession {
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? state.sessions[0];
}

function updateSession(
  state: OfficeChatStoreState,
  sessionId: string,
  updater: (session: OfficeChatSession) => OfficeChatSession,
): OfficeChatStoreState {
  const sessions = state.sessions.map((session) => (session.id === sessionId ? updater(session) : session));
  return ensureStoreState({
    activeSessionId: sessionId,
    sessions,
  });
}

function supportsStreamingChat(
  client: ChatCapability | (ChatCapability & StreamingChatCapability),
): client is ChatCapability & StreamingChatCapability {
  return typeof (client as Partial<StreamingChatCapability>).streamChat === 'function';
}

function updateAssistantMessage(
  state: OfficeChatStoreState,
  sessionId: string,
  assistantMessageId: string,
  content: string,
  status: OfficeChatMessage['status'],
): OfficeChatStoreState {
  return updateSession(state, sessionId, (session) => ({
    ...session,
    updatedAt: new Date().toISOString(),
    messages: session.messages.map((message) =>
      message.id === assistantMessageId
        ? {
            ...message,
            content,
            status,
          }
        : message,
    ),
  }));
}

export function useOfficeChat({
  client,
  sessionStoreNamespace = 'default',
  maxSessions = 12,
  onSessionExpired,
}: UseOfficeChatOptions): UseOfficeChatResult {
  const [storeState, setStoreState] = useState<OfficeChatStoreState>(() => loadOfficeChatStore(sessionStoreNamespace));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');

  useEffect(() => {
    setStoreState(loadOfficeChatStore(sessionStoreNamespace));
    setLoading(false);
    setError('');
    setInput('');
  }, [sessionStoreNamespace]);

  useEffect(() => {
    saveOfficeChatStore(sessionStoreNamespace, ensureStoreState(storeState), maxSessions);
  }, [maxSessions, sessionStoreNamespace, storeState]);

  const activeSession = useMemo(() => getActiveSession(ensureStoreState(storeState)), [storeState]);
  const latestResponse = useMemo(
    () => [...activeSession.messages].reverse().find((message) => message.role === 'assistant')?.content ?? '',
    [activeSession.messages],
  );

  const createSession = useCallback(() => {
    if (loading) {
      return;
    }

    const session = createOfficeChatSession();
    setStoreState((current) => ({
      activeSessionId: session.id,
      sessions: [session, ...current.sessions],
    }));
    setInput('');
    setError('');
  }, [loading]);

  const selectSession = useCallback((sessionId: string) => {
    setStoreState((current) => {
      if (!current.sessions.some((session) => session.id === sessionId)) {
        return current;
      }

      return {
        ...current,
        activeSessionId: sessionId,
      };
    });
    setInput('');
    setError('');
  }, []);

  const generateResponse = useCallback(
    async (request: string | ChatPromptRequest) => {
      const resolvedRequest = resolveRequest(request);
      const prompt = resolvedRequest.prompt.trim();
      if (!prompt || loading) {
        return;
      }

      const userFacingInput = (resolvedRequest.displayInput ?? prompt).trim();
      const sessionId = activeSession.id;
      const now = new Date().toISOString();
      const userMessage: OfficeChatMessage = {
        id: `user-${now}-${Math.random().toString(16).slice(2)}`,
        role: 'user',
        content: userFacingInput,
        createdAt: now,
        status: 'complete',
      };
      const assistantMessageId = `assistant-${now}-${Math.random().toString(16).slice(2)}`;
      const assistantMessage: OfficeChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: now,
        status: 'streaming',
      };

      setLoading(true);
      setError('');
      setStoreState((current) =>
        updateSession(current, sessionId, (session) => ({
          ...session,
          title:
            session.messages.length === 0 || session.title === 'New chat'
              ? formatOfficeChatSessionTitle(userFacingInput)
              : session.title,
          updatedAt: now,
          messages: [...session.messages, userMessage, assistantMessage],
        })),
      );
      setInput('');

      try {
        let assistantText = '';

        if (supportsStreamingChat(client)) {
          for await (const chunk of client.streamChat(prompt)) {
            if (chunk.type === 'delta' && chunk.delta) {
              assistantText += chunk.delta;
              setStoreState((current) =>
                updateAssistantMessage(current, sessionId, assistantMessageId, assistantText, 'streaming'),
              );
            }

            if (chunk.type === 'done' && chunk.outputText && !assistantText) {
              assistantText = chunk.outputText;
            }
          }
        } else {
          assistantText = getResponseText(await client.chat(prompt));
        }

        const finalText = assistantText || 'Hermes finished without returning any text.';
        setStoreState((current) => updateAssistantMessage(current, sessionId, assistantMessageId, finalText, 'complete'));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Chat request failed';
        setStoreState((current) => updateAssistantMessage(current, sessionId, assistantMessageId, message, 'error'));
        setError(message);

        if (err instanceof BridgeSessionExpiredError || (err instanceof Error && err.name === 'BridgeSessionExpiredError')) {
          onSessionExpired?.();
        }
      } finally {
        setLoading(false);
      }
    },
    [activeSession.id, client, loading, onSessionExpired],
  );

  const sessions = useMemo(
    () =>
      [...storeState.sessions].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).map((session) => ({
        ...session,
        title: session.title || formatOfficeChatSessionTitle(getOfficeChatSessionPreview(session)),
      })),
    [storeState.sessions],
  );

  return {
    sessions,
    activeSessionId: activeSession.id,
    activeSession,
    messages: activeSession.messages,
    latestResponse,
    loading,
    error,
    input,
    setInput,
    createSession,
    selectSession,
    generateResponse,
  };
}
