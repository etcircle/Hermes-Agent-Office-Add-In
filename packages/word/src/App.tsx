import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChatShell,
  clearStoredSessionToken,
  getStoredSessionToken,
  HermesBackendClient,
  LoginPage,
} from '@hermes-agent-office/shared';
import './styles.css';
import { createWordHost, type WordHost } from './word-host';

type AppClient = Pick<HermesBackendClient, 'chat' | 'login'>;

interface AppProps {
  client?: AppClient;
  wordHost?: WordHost;
}

export function App({ client: providedClient, wordHost: providedWordHost }: AppProps = {}) {
  const defaultClient = useMemo(() => new HermesBackendClient({ baseUrl: window.location.origin }), []);
  const client = providedClient ?? defaultClient;
  const wordHost = useMemo(() => providedWordHost ?? createWordHost(), [providedWordHost]);
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredSessionToken());
  const [selectionText, setSelectionText] = useState('');
  const [selectionState, setSelectionState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [documentMessage, setDocumentMessage] = useState('');
  const availability = wordHost.getAvailability();
  const responseUnavailableReason = availability.reason || 'Word document actions are currently unavailable.';

  function handleLogin(token: string) {
    setSessionToken(token);
  }

  function handleLogout() {
    clearStoredSessionToken();
    setSessionToken(null);
  }

  const refreshSelection = useCallback(async () => {
    if (!availability.available) {
      return;
    }

    setSelectionState('loading');
    setDocumentMessage('');

    try {
      const nextSelection = await wordHost.getSelectionText();
      setSelectionText(nextSelection);
      setSelectionState('ready');
    } catch (error) {
      setSelectionState('error');
      setDocumentMessage(error instanceof Error ? error.message : 'Unable to read the current Word selection.');
    }
  }, [availability.available, wordHost]);

  useEffect(() => {
    if (!sessionToken) {
      setSelectionText('');
      setSelectionState('idle');
      setDocumentMessage('');
      return;
    }

    if (!availability.available) {
      setSelectionText('');
      setSelectionState('idle');
      setDocumentMessage('');
      return;
    }

    void refreshSelection();
  }, [availability.available, refreshSelection, sessionToken]);

  async function handleInsert(response: string) {
    if (!response.trim() || !availability.available) {
      return;
    }

    setDocumentMessage('');

    try {
      await wordHost.insertTextAtSelectionOrEnd(response);
      setDocumentMessage('Inserted the latest Hermes response into the document.');
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : 'Unable to insert the latest Hermes response.');
    }
  }

  async function handleReplace(response: string) {
    if (!response.trim() || !availability.available) {
      return;
    }

    setDocumentMessage('');

    try {
      await wordHost.replaceSelection(response);
      setDocumentMessage('Replaced the current selection with the latest Hermes response.');
      await refreshSelection();
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : 'Unable to replace the current selection.');
    }
  }

  function renderDocumentActions(response: string) {
    const hasResponse = Boolean(response.trim());
    const selectionSummary = availability.available
      ? selectionState === 'loading'
        ? 'Reading current selection…'
        : selectionText || 'Nothing selected in the document.'
      : 'Selection preview unavailable outside Microsoft Word.';

    return (
      <section className="word-app-shell__document-panel" aria-label="Word document actions">
        <div className="word-app-shell__document-header">
          <div>
            <div className="ha-response-label">Current selection</div>
            <div className="ha-muted">Use your latest Hermes response in the active Word document.</div>
          </div>
          <button
            type="button"
            className="word-app-shell__secondary-action"
            onClick={() => void refreshSelection()}
            disabled={!availability.available || selectionState === 'loading'}
            title={!availability.available ? responseUnavailableReason : 'Read the current Word selection'}
          >
            Refresh selection
          </button>
        </div>

        <div className="word-app-shell__selection-preview">{selectionSummary}</div>

        {!availability.available ? (
          <div className="ha-muted word-app-shell__document-note">{responseUnavailableReason}</div>
        ) : null}

        <div className="word-app-shell__document-actions">
          <button
            type="button"
            onClick={() => void handleInsert(response)}
            disabled={!availability.available || !hasResponse}
            title={!availability.available ? responseUnavailableReason : 'Insert the latest Hermes response into Word'}
          >
            Insert into document
          </button>
          <button
            type="button"
            className="word-app-shell__secondary-action"
            onClick={() => void handleReplace(response)}
            disabled={!availability.available || !hasResponse}
            title={!availability.available ? responseUnavailableReason : 'Replace the current selection with the latest Hermes response'}
          >
            Replace selection
          </button>
        </div>

        {documentMessage ? <div className="ha-muted word-app-shell__document-note">{documentMessage}</div> : null}
      </section>
    );
  }

  return (
    <div className="ha-app word-app-shell">
      <div className="word-app-shell__toolbar">
        <div>
          <div className="word-app-shell__product">Hermes Agent</div>
          <div className="word-app-shell__host">Word Add-in</div>
        </div>
        {sessionToken ? (
          <button type="button" className="word-app-shell__logout" onClick={handleLogout}>
            Log out
          </button>
        ) : null}
      </div>
      {sessionToken ? (
        <ChatShell client={client} title="Hermes Agent for Word" renderResponseActions={renderDocumentActions} />
      ) : (
        <LoginPage client={client} onSuccess={handleLogin} />
      )}
    </div>
  );
}
