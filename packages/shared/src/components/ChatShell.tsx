import { FormEvent, ReactNode } from 'react';
import type { ChatCapability, StreamingChatCapability } from '../contracts/capabilities';
import { getOfficeChatSessionPreview } from '../chat/session-store';
import { type ChatPromptRequest, useOfficeChat } from '../chat/useOfficeChat';
import './chat-shell.css';

export interface ChatShellResponseActions {
  response: string;
  loading: boolean;
  generateResponse: (request: string | ChatPromptRequest) => Promise<void>;
}

interface ChatShellProps {
  client: ChatCapability | (ChatCapability & StreamingChatCapability);
  title: string;
  sessionStoreNamespace?: string;
  onSessionExpired?: () => void;
  renderResponseActions?: (actions: ChatShellResponseActions) => ReactNode;
}

function formatSessionTimestamp(updatedAt: string): string {
  const value = new Date(updatedAt);
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export function ChatShell({
  client,
  title,
  sessionStoreNamespace = 'default',
  onSessionExpired,
  renderResponseActions,
}: ChatShellProps) {
  const {
    sessions,
    activeSessionId,
    messages,
    latestResponse,
    loading,
    error,
    input,
    setInput,
    createSession,
    selectSession,
    generateResponse,
  } = useOfficeChat({
    client,
    sessionStoreNamespace,
    onSessionExpired,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await generateResponse(input);
  }

  return (
    <div className="ha-chat-shell">
      <aside className="ha-chat-shell__sessions" aria-label="Recent chat sessions">
        <div className="ha-chat-shell__sessions-header">
          <h2 className="ha-chat-shell__sessions-title">Recent sessions</h2>
          <button type="button" className="ha-chat-shell__new-session" onClick={createSession} disabled={loading}>
            New chat
          </button>
        </div>
        <div className="ha-chat-shell__session-list">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                type="button"
                className={`ha-chat-shell__session-button${isActive ? ' ha-chat-shell__session-button--active' : ''}`}
                onClick={() => selectSession(session.id)}
                disabled={loading && !isActive}
              >
                <div className="ha-chat-shell__session-meta">
                  <span className="ha-chat-shell__session-name">{session.title}</span>
                  <span className="ha-chat-shell__session-time">{formatSessionTimestamp(session.updatedAt)}</span>
                </div>
                <p className="ha-chat-shell__session-preview">{getOfficeChatSessionPreview(session)}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="ha-chat-shell__main">
        <div>
          <div className="ha-eyebrow">Hermes Agent</div>
          <h1>{title}</h1>
          <p className="ha-muted">Ask Hermes to help write, rewrite, or structure what you need.</p>
        </div>

        <div className="ha-chat-shell__messages" aria-label="Conversation transcript">
          {messages.length ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={`ha-chat-shell__message ha-chat-shell__message--${message.role}${
                  message.status === 'error' ? ' ha-chat-shell__message--error' : ''
                }${message.status === 'streaming' ? ' ha-chat-shell__message--streaming' : ''}`}
              >
                <pre className="ha-chat-shell__bubble">{message.content || (message.status === 'streaming' ? 'Hermes is thinking…' : '')}</pre>
              </div>
            ))
          ) : (
            <p className="ha-chat-shell__empty ha-muted">
              Start a new chat here. Recent sessions stay on the left so Word, PowerPoint, and Outlook can share the same runtime shape.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="ha-stack">
          <label className="ha-stack">
            <span>Message</span>
            <textarea
              aria-label="Message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Write me an intro for a client proposal"
              rows={5}
            />
          </label>
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? 'Sending…' : 'Send'}
          </button>
        </form>

        {error ? <div className="ha-error">{error}</div> : null}

        <div className="ha-response">
          <div className="ha-response-label">Latest Hermes response</div>
          <pre>{latestResponse || 'Your response will appear here.'}</pre>
          {renderResponseActions ? (
            <div className="ha-response-actions">
              {renderResponseActions({ response: latestResponse, loading, generateResponse })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
