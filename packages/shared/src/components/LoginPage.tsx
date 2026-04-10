import { FormEvent, useState } from 'react';
import type { SessionCapability } from '../contracts/capabilities';

interface LoginPageProps {
  client: Pick<SessionCapability, 'login'>;
  onSuccess: (token: string) => void;
}

export function LoginPage({ client, onSuccess }: LoginPageProps) {
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passphrase.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const result = await client.login(passphrase.trim());
      onSuccess(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ha-card ha-login-card">
      <div className="ha-eyebrow">Hermes Agent</div>
      <h1>Unlock Word</h1>
      <p className="ha-muted">Connect this add-in to your local Hermes bridge.</p>
      <form onSubmit={handleSubmit} className="ha-stack">
        <label className="ha-stack">
          <span>Passphrase</span>
          <input
            aria-label="Passphrase"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Enter local bridge passphrase"
          />
        </label>
        {error ? <div className="ha-error">{error}</div> : null}
        <button type="submit" disabled={loading || !passphrase.trim()}>
          {loading ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
