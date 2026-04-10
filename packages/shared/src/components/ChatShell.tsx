import { FormEvent, ReactNode, useState } from 'react';
import type { HermesBackendClient } from '../backend-client';

interface ChatShellProps {
  client: Pick<HermesBackendClient, 'chat'>;
  title: string;
  renderResponseActions?: (response: string) => ReactNode;
}

export function ChatShell({ client, title, renderResponseActions }: ChatShellProps) {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const result = await client.chat(message.trim());
      setResponse(result.output_text || JSON.stringify(result.output ?? {}, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ha-card ha-chat-shell">
      <div className="ha-eyebrow">Hermes Agent</div>
      <h1>{title}</h1>
      <p className="ha-muted">Ask Hermes to help write, rewrite, or structure what you need.</p>
      <form onSubmit={handleSubmit} className="ha-stack">
        <label className="ha-stack">
          <span>Message</span>
          <textarea
            aria-label="Message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write me an intro for a client proposal"
            rows={5}
          />
        </label>
        <button type="submit" disabled={loading || !message.trim()}>
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>
      {error ? <div className="ha-error">{error}</div> : null}
      <div className="ha-response">
        <div className="ha-response-label">Hermes response</div>
        <pre>{response || 'Your response will appear here.'}</pre>
        {renderResponseActions ? <div className="ha-response-actions">{renderResponseActions(response)}</div> : null}
      </div>
    </div>
  );
}
