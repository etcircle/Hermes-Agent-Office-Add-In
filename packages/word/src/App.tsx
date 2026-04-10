import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChatShell,
  clearStoredSessionToken,
  getStoredSessionToken,
  HermesBackendClient,
  LoginPage,
  type ChatShellResponseActions,
} from '@hermes-agent-office/shared';
import './styles.css';
import { createWordHost, type WordHost } from './word-host';

type AppClient = Pick<HermesBackendClient, 'chat' | 'login'>;

type SelectionState = 'idle' | 'loading' | 'ready' | 'error';

interface AppProps {
  client?: AppClient;
  wordHost?: WordHost;
}

interface SelectionQuickAction {
  label: string;
  buildPrompt: (selection: string) => string;
}

const selectionQuickActions: SelectionQuickAction[] = [
  {
    label: 'Rewrite selection',
    buildPrompt: (selection) => `Rewrite the following Word selection so it is clearer, smoother, and professionally polished while preserving the original meaning, tone, and factual details. Return only the rewritten text with no commentary or markdown.\n\nWord selection:\n"""\n${selection}\n"""`,
  },
  {
    label: 'Expand selection',
    buildPrompt: (selection) => `Expand the following Word selection into a fuller draft with more detail, clarity, and useful context while staying consistent with the original intent and tone. Return only the expanded text with no commentary or markdown.\n\nWord selection:\n"""\n${selection}\n"""`,
  },
  {
    label: 'Summarise selection',
    buildPrompt: (selection) => `Summarise the following Word selection into a concise, accurate summary that preserves the key points and core intent. Return only the summary text with no commentary or markdown.\n\nWord selection:\n"""\n${selection}\n"""`,
  },
];

export function App({ client: providedClient, wordHost: providedWordHost }: AppProps = {}) {
  const defaultClient = useMemo(() => new HermesBackendClient({ baseUrl: window.location.origin }), []);
  const client = providedClient ?? defaultClient;
  const wordHost = useMemo(() => providedWordHost ?? createWordHost(), [providedWordHost]);
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredSessionToken());
  const [selectionText, setSelectionText] = useState('');
  const [selectionState, setSelectionState] = useState<SelectionState>('idle');
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

  async function handleSelectionQuickAction(
    action: SelectionQuickAction,
    generateResponse: ChatShellResponseActions['generateResponse'],
  ) {
    if (!availability.available || !selectionText.trim()) {
      return;
    }

    setDocumentMessage('');
    await generateResponse(action.buildPrompt(selectionText));
  }

  function renderDocumentActions({ response, loading, generateResponse }: ChatShellResponseActions) {
    const hasResponse = Boolean(response.trim());
    const hasSelection = Boolean(selectionText.trim());
    const disableSelectionQuickActions = !availability.available || !hasSelection || selectionState === 'loading' || loading;
    const selectionSummary = availability.available
      ? selectionState === 'loading'
        ? 'Reading current selection…'
        : selectionText || 'Nothing selected in the document.'
      : 'Selection preview unavailable outside Microsoft Word.';
    const selectionActionHint = !availability.available
      ? 'Open this add-in inside Microsoft Word to use selection quick actions.'
      : hasSelection
        ? 'Use the current Word selection to generate a fresh Hermes draft.'
        : 'Select some text in Word to rewrite, expand, or summarise it.';

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
            disabled={!availability.available || selectionState === 'loading' || loading}
            title={!availability.available ? responseUnavailableReason : 'Read the current Word selection'}
          >
            Refresh selection
          </button>
        </div>

        <div className="word-app-shell__selection-preview">{selectionSummary}</div>

        <div className="word-app-shell__document-section">
          <div>
            <div className="ha-response-label">Quick actions</div>
            <div className="ha-muted">{selectionActionHint}</div>
          </div>
          <div className="word-app-shell__document-actions">
            {selectionQuickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="word-app-shell__secondary-action"
                onClick={() => void handleSelectionQuickAction(action, generateResponse)}
                disabled={disableSelectionQuickActions}
                title={selectionActionHint}
                aria-label={action.label}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {!availability.available ? (
          <div className="ha-muted word-app-shell__document-note">{responseUnavailableReason}</div>
        ) : null}

        <div className="word-app-shell__document-section">
          <div>
            <div className="ha-response-label">Use latest response</div>
            <div className="ha-muted">Insert or replace with the most recent Hermes output shown above.</div>
          </div>
          <div className="word-app-shell__document-actions">
            <button
              type="button"
              onClick={() => void handleInsert(response)}
              disabled={!availability.available || !hasResponse || loading}
              title={!availability.available ? responseUnavailableReason : 'Insert the latest Hermes response into Word'}
            >
              Insert into document
            </button>
            <button
              type="button"
              className="word-app-shell__secondary-action"
              onClick={() => void handleReplace(response)}
              disabled={!availability.available || !hasResponse || loading}
              title={!availability.available ? responseUnavailableReason : 'Replace the current selection with the latest Hermes response'}
            >
              Replace selection
            </button>
          </div>
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
