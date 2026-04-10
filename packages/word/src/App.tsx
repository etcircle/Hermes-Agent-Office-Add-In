import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChatShell,
  clearStoredSessionToken,
  getStoredSessionToken,
  hasStoredSessionToken,
  BridgeSessionExpiredError,
  HermesBackendClient,
  LoginPage,
  OfficeAppShell,
  type ChatCapability,
  type ChatShellResponseActions,
  type OfficeWorkspaceTab,
  type SessionCapability,
} from '@hermes-agent-office/shared';
import './styles.css';
import { createWordHost, type WordHost } from './word-host';
import { createWordHostAdapter } from './word-host-adapter';
import type { WordSelectionQuickAction } from './word-quick-actions';

type AppClient = ChatCapability & SessionCapability;

type SelectionState = 'idle' | 'loading' | 'ready' | 'error';
type AuthBootstrapState = 'checking' | 'ready';

interface AppProps {
  client?: AppClient;
  wordHost?: WordHost;
}

export function App({ client: providedClient, wordHost: providedWordHost }: AppProps = {}) {
  const defaultClient = useMemo(() => new HermesBackendClient({ baseUrl: window.location.origin }), []);
  const client = providedClient ?? defaultClient;
  const wordHost = useMemo(() => providedWordHost ?? createWordHost(), [providedWordHost]);
  const wordHostAdapter = useMemo(() => createWordHostAdapter(wordHost), [wordHost]);
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredSessionToken());
  const [authBootstrapState, setAuthBootstrapState] = useState<AuthBootstrapState>(() =>
    hasStoredSessionToken() ? 'checking' : 'ready',
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectionText, setSelectionText] = useState('');
  const [selectionState, setSelectionState] = useState<SelectionState>('idle');
  const [documentMessage, setDocumentMessage] = useState('');
  const availability = wordHostAdapter.getAvailability();
  const responseUnavailableReason = availability.reason || 'Word document actions are currently unavailable.';

  function handleLogin(token: string) {
    setSessionToken(token);
    setAuthBootstrapState('ready');
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await client.logout();
    } catch {
      // local logout should still win even if the bridge is temporarily unreachable
    } finally {
      clearStoredSessionToken();
      setSessionToken(null);
      setAuthBootstrapState('ready');
      setLoggingOut(false);
    }
  }

  const chatClient = useMemo<ChatCapability>(
    () => ({
      chat: async (input: string) => {
        try {
          return await client.chat(input);
        } catch (error) {
          if (error instanceof BridgeSessionExpiredError) {
            clearStoredSessionToken();
            setSessionToken(null);
            setAuthBootstrapState('ready');
          }

          throw error;
        }
      },
    }),
    [client],
  );

  const refreshSelection = useCallback(async () => {
    if (!availability.available) {
      return;
    }

    setSelectionState('loading');
    setDocumentMessage('');

    try {
      const context = await wordHostAdapter.getContext();
      setSelectionText(context.selectionText);
      setSelectionState('ready');
    } catch (error) {
      setSelectionState('error');
      setDocumentMessage(error instanceof Error ? error.message : 'Unable to read the current Word selection.');
    }
  }, [availability.available, wordHostAdapter]);

  useEffect(() => {
    const storedToken = getStoredSessionToken();

    if (!storedToken) {
      setSessionToken(null);
      setAuthBootstrapState('ready');
      return;
    }

    let cancelled = false;
    setAuthBootstrapState('checking');

    void client
      .getBridgeSession()
      .then((bridgeSession) => {
        if (cancelled) {
          return;
        }

        if (!bridgeSession.authenticated) {
          clearStoredSessionToken();
          setSessionToken(null);
          return;
        }

        setSessionToken(storedToken);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSessionToken(storedToken);
      })
      .finally(() => {
        if (!cancelled) {
          setAuthBootstrapState('ready');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!sessionToken || authBootstrapState !== 'ready') {
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
  }, [authBootstrapState, availability.available, refreshSelection, sessionToken]);

  async function handleInsert(response: string) {
    if (!response.trim() || !availability.available) {
      return;
    }

    setDocumentMessage('');

    try {
      await wordHostAdapter.applyResponse(response, 'insert-latest-response');
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
      await wordHostAdapter.applyResponse(response, 'replace-selection');
      setDocumentMessage('Replaced the current selection with the latest Hermes response.');
      await refreshSelection();
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : 'Unable to replace the current selection.');
    }
  }

  async function handleSelectionQuickAction(
    action: WordSelectionQuickAction,
    generateResponse: ChatShellResponseActions['generateResponse'],
  ) {
    if (!availability.available || !selectionText.trim()) {
      return;
    }

    setDocumentMessage('');
    await generateResponse(action.buildPrompt({ selectionText }));
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
            {wordHostAdapter.getQuickActions().map((action) => (
              <button
                key={action.id}
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

  const workspaces = useMemo<OfficeWorkspaceTab[]>(
    () => [
      {
        id: 'chat',
        label: 'Chat',
        content: <ChatShell client={chatClient} title="Hermes Agent for Word" renderResponseActions={renderDocumentActions} />,
      },
      {
        id: 'research',
        label: 'Research',
        content: renderPlaceholderWorkspace(
          'Research workspace',
          'Research workspace is coming next. This shared tab will handle search, pinned findings, and handoff back into chat.',
        ),
      },
      {
        id: 'visuals',
        label: 'Visuals',
        content: renderPlaceholderWorkspace(
          'Visuals workspace',
          'Visuals workspace is coming next. This shared tab will host Mermaid-first diagram generation and refinement.',
        ),
      },
      {
        id: 'assets',
        label: 'Assets',
        content: renderPlaceholderWorkspace(
          'Assets workspace',
          'Assets workspace is coming next. This shared tab will hold saved outputs, templates, and reusable building blocks.',
        ),
      },
    ],
    [chatClient, renderDocumentActions],
  );

  return (
    <div className="ha-app word-app-shell">
      {authBootstrapState === 'checking' ? (
        <div className="ha-card ha-login-card">
          <div className="ha-eyebrow">Hermes Agent</div>
          <h1>Restoring your bridge session</h1>
          <p className="ha-muted">Checking whether your saved local Hermes bridge session is still valid.</p>
        </div>
      ) : sessionToken ? (
        <OfficeAppShell
          productName="Hermes Agent"
          hostName="Word Add-in"
          workspaces={workspaces}
          onLogout={handleLogout}
          logoutDisabled={loggingOut}
          logoutLabel={loggingOut ? 'Logging out…' : 'Log out'}
        />
      ) : (
        <LoginPage client={client} onSuccess={handleLogin} />
      )}
    </div>
  );
}

function renderPlaceholderWorkspace(title: string, body: string) {
  return (
    <section className="ha-workspace-placeholder" aria-label={title}>
      <h2 className="ha-workspace-placeholder__title">{title}</h2>
      <p className="ha-muted ha-workspace-placeholder__body">{body}</p>
    </section>
  );
}
