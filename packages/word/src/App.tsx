import { useMemo, useState } from 'react';
import {
  ChatShell,
  clearStoredSessionToken,
  getStoredSessionToken,
  HermesBackendClient,
  LoginPage,
} from '@hermes-agent-office/shared';
import './styles.css';

export function App() {
  const client = useMemo(() => new HermesBackendClient({ baseUrl: window.location.origin }), []);
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredSessionToken());

  function handleLogin(token: string) {
    setSessionToken(token);
  }

  function handleLogout() {
    clearStoredSessionToken();
    setSessionToken(null);
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
        <ChatShell client={client} title="Hermes Agent for Word" />
      ) : (
        <LoginPage client={client} onSuccess={handleLogin} />
      )}
    </div>
  );
}
