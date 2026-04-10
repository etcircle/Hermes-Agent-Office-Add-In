export type OfficeChatRole = 'user' | 'assistant';
export type OfficeChatMessageStatus = 'complete' | 'streaming' | 'error';

export interface OfficeChatMessage {
  id: string;
  role: OfficeChatRole;
  content: string;
  createdAt: string;
  status: OfficeChatMessageStatus;
}

export interface OfficeChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: OfficeChatMessage[];
}

export interface OfficeChatStoreState {
  activeSessionId: string;
  sessions: OfficeChatSession[];
}

const STORAGE_PREFIX = 'hermes_agent_office_chat_store';
const DEFAULT_SESSION_TITLE = 'New chat';

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isOfficeChatMessage(value: unknown): value is OfficeChatMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<OfficeChatMessage>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string' &&
    typeof candidate.createdAt === 'string' &&
    (candidate.status === 'complete' || candidate.status === 'streaming' || candidate.status === 'error')
  );
}

function isOfficeChatSession(value: unknown): value is OfficeChatSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<OfficeChatSession>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every(isOfficeChatMessage)
  );
}

function normaliseSessions(sessions: OfficeChatSession[]): OfficeChatSession[] {
  return [...sessions].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function buildStorageKey(namespace: string): string {
  return `${STORAGE_PREFIX}:${namespace}`;
}

export function createOfficeChatSession(now = new Date().toISOString()): OfficeChatSession {
  return {
    id: createId(),
    title: DEFAULT_SESSION_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function createOfficeChatStoreState(now = new Date().toISOString()): OfficeChatStoreState {
  const session = createOfficeChatSession(now);
  return {
    activeSessionId: session.id,
    sessions: [session],
  };
}

export function formatOfficeChatSessionTitle(input: string): string {
  const trimmed = input.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return DEFAULT_SESSION_TITLE;
  }

  return trimmed.length > 56 ? `${trimmed.slice(0, 53)}…` : trimmed;
}

export function getOfficeChatSessionPreview(session: OfficeChatSession): string {
  const lastMessage = [...session.messages].reverse().find((message) => message.content.trim());
  if (!lastMessage) {
    return 'Start a conversation';
  }

  const flattened = lastMessage.content.replace(/\s+/g, ' ').trim();
  return flattened.length > 88 ? `${flattened.slice(0, 85)}…` : flattened;
}

export function loadOfficeChatStore(namespace = 'default'): OfficeChatStoreState {
  try {
    const raw = localStorage.getItem(buildStorageKey(namespace));
    if (!raw) {
      return createOfficeChatStoreState();
    }

    const parsed = JSON.parse(raw) as Partial<OfficeChatStoreState>;
    if (!parsed || typeof parsed.activeSessionId !== 'string' || !Array.isArray(parsed.sessions)) {
      return createOfficeChatStoreState();
    }

    const sessions = parsed.sessions.filter(isOfficeChatSession);
    if (!sessions.length) {
      return createOfficeChatStoreState();
    }

    const normalised = normaliseSessions(sessions);
    const activeSessionId = normalised.some((session) => session.id === parsed.activeSessionId)
      ? parsed.activeSessionId
      : normalised[0].id;

    return {
      activeSessionId,
      sessions: normalised,
    };
  } catch {
    return createOfficeChatStoreState();
  }
}

export function saveOfficeChatStore(namespace: string, state: OfficeChatStoreState, maxSessions = 12): OfficeChatStoreState {
  const sessions = normaliseSessions(state.sessions).slice(0, maxSessions);
  const activeSessionId = sessions.some((session) => session.id === state.activeSessionId)
    ? state.activeSessionId
    : sessions[0]?.id ?? createOfficeChatSession().id;
  const nextState = sessions.length
    ? { activeSessionId, sessions }
    : createOfficeChatStoreState();

  try {
    localStorage.setItem(buildStorageKey(namespace), JSON.stringify(nextState));
  } catch {
    // ignore localStorage issues in unsupported environments
  }

  return nextState;
}
