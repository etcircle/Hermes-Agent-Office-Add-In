import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BridgeSessionExpiredError,
  clearStoredSessionToken,
  getStoredSessionToken,
  setStoredSessionToken,
} from '@hermes-agent-office/shared';
import { App } from './App';

describe('Word App shell', () => {
  beforeEach(() => {
    localStorage.clear();
    clearStoredSessionToken();
    vi.restoreAllMocks();
  });

  it('shows the login screen when no bridge session token exists', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /unlock hermes add-in/i })).toBeInTheDocument();
  });

  it('silently restores the chat shell when the cached bridge session is still valid', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn(),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockResolvedValue({ authenticated: true, expiresAt: '2026-04-11T00:00:00.000Z' }),
      logout: vi.fn(),
    };

    render(
      <App
        client={client as never}
        wordHost={{
          getAvailability: () => ({ available: false, reason: 'Word document actions are only available inside Microsoft Word.' }),
          getSelectionText: vi.fn(),
          insertTextAtSelectionOrEnd: vi.fn(),
          replaceSelection: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText(/restoring your bridge session/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(client.getBridgeSession).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', { name: /hermes agent for word/i })).toBeInTheDocument();
    });
  });

  it('clears the cached token and shows login when the saved bridge session is no longer valid', async () => {
    setStoredSessionToken('expired-token');

    const client = {
      chat: vi.fn(),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockResolvedValue({ authenticated: false, expiresAt: null }),
      logout: vi.fn(),
    };

    render(
      <App
        client={client as never}
        wordHost={{
          getAvailability: () => ({ available: false, reason: 'Word document actions are only available inside Microsoft Word.' }),
          getSelectionText: vi.fn(),
          insertTextAtSelectionOrEnd: vi.fn(),
          replaceSelection: vi.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /unlock hermes add-in/i })).toBeInTheDocument();
    });

    expect(getStoredSessionToken()).toBeNull();
  });

  it('keeps the user in the chat shell when bridge session revalidation fails transiently', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn(),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockRejectedValue(new Error('Bridge unreachable')),
      logout: vi.fn(),
    };

    render(
      <App
        client={client as never}
        wordHost={{
          getAvailability: () => ({ available: false, reason: 'Word document actions are only available inside Microsoft Word.' }),
          getSelectionText: vi.fn(),
          insertTextAtSelectionOrEnd: vi.fn(),
          replaceSelection: vi.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /hermes agent for word/i })).toBeInTheDocument();
    });

    expect(getStoredSessionToken()).toBe('session-1');
  });

  it('shows the chat shell after a successful login', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'session-1', expiresAt: '2026-04-11T00:00:00.000Z' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: 'secret-passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /hermes agent for word/i })).toBeInTheDocument();
    });
  });

  it('calls bridge logout before returning to the login screen', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn(),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockResolvedValue({ authenticated: true, expiresAt: '2026-04-11T00:00:00.000Z' }),
      logout: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <App
        client={client as never}
        wordHost={{
          getAvailability: () => ({ available: false, reason: 'Word document actions are only available inside Microsoft Word.' }),
          getSelectionText: vi.fn(),
          insertTextAtSelectionOrEnd: vi.fn(),
          replaceSelection: vi.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(client.logout).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', { name: /unlock hermes add-in/i })).toBeInTheDocument();
    });

    expect(getStoredSessionToken()).toBeNull();
  });

  it('shows a clear unavailable document state outside Office', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn().mockResolvedValue({ output_text: 'Hermes reply' }),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockResolvedValue({ authenticated: true, expiresAt: '2026-04-11T00:00:00.000Z' }),
      logout: vi.fn(),
    };

    render(
      <App
        client={client as never}
        wordHost={{
          getAvailability: () => ({
            available: false,
            reason: 'Word document actions are only available inside Microsoft Word.',
          }),
          getSelectionText: vi.fn(),
          insertTextAtSelectionOrEnd: vi.fn(),
          replaceSelection: vi.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /hermes agent for word/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/word document actions are only available inside microsoft word/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /refresh selection/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rewrite selection/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /expand selection/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /summarise selection/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Draft a summary' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Hermes reply')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /insert into document/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /replace selection/i })).toBeDisabled();
  });

  it('returns to login when Hermes reports an expired bridge session during chat', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn().mockRejectedValue(new BridgeSessionExpiredError()),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockResolvedValue({ authenticated: true, expiresAt: '2026-04-11T00:00:00.000Z' }),
      logout: vi.fn(),
    };

    render(
      <App
        client={client as never}
        wordHost={{
          getAvailability: () => ({
            available: false,
            reason: 'Word document actions are only available inside Microsoft Word.',
          }),
          getSelectionText: vi.fn(),
          insertTextAtSelectionOrEnd: vi.fn(),
          replaceSelection: vi.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /hermes agent for word/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Draft a summary' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /unlock hermes add-in/i })).toBeInTheDocument();
    });

    expect(getStoredSessionToken()).toBeNull();
  });

  it('shows the shared workspace tabs and switches to placeholder workspaces', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn(),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockResolvedValue({ authenticated: true, expiresAt: '2026-04-11T00:00:00.000Z' }),
      logout: vi.fn(),
    };

    render(
      <App
        client={client as never}
        wordHost={{
          getAvailability: () => ({ available: false, reason: 'Word document actions are only available inside Microsoft Word.' }),
          getSelectionText: vi.fn(),
          insertTextAtSelectionOrEnd: vi.fn(),
          replaceSelection: vi.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /chat/i, selected: true })).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: /research/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /visuals/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /assets/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /research/i }));
    expect(screen.getByText(/research workspace is coming next/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /chat/i }));
    expect(screen.getByRole('heading', { name: /hermes agent for word/i })).toBeInTheDocument();
  });

  it('uses quick actions for the current selection and applies the latest Hermes response to the document', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi
        .fn()
        .mockResolvedValueOnce({ output_text: 'Hermes rewrite' })
        .mockResolvedValueOnce({ output_text: 'Hermes expansion' })
        .mockResolvedValueOnce({ output_text: 'Hermes summary' }),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockResolvedValue({ authenticated: true, expiresAt: '2026-04-11T00:00:00.000Z' }),
      logout: vi.fn(),
    };
    const wordHost = {
      getAvailability: () => ({ available: true, reason: '' }),
      getSelectionText: vi.fn().mockResolvedValue('Selected draft'),
      insertTextAtSelectionOrEnd: vi.fn().mockResolvedValue(undefined),
      replaceSelection: vi.fn().mockResolvedValue(undefined),
    };

    render(<App client={client as never} wordHost={wordHost} />);

    expect(await screen.findByText('Selected draft')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /rewrite selection/i }));
    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Hermes rewrite')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /expand selection/i }));
    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Hermes expansion')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /summarise selection/i }));
    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Hermes summary')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(client.chat).toHaveBeenCalledTimes(3);
    });

    expect(client.chat).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Selected draft'),
    );
    expect(client.chat).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('Selected draft'),
    );
    expect(client.chat).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('Selected draft'),
    );
    expect(client.chat.mock.calls[0]?.[0]).toMatch(/rewrite/i);
    expect(client.chat.mock.calls[1]?.[0]).toMatch(/expand/i);
    expect(client.chat.mock.calls[2]?.[0]).toMatch(/summari[sz]e/i);

    fireEvent.click(screen.getByRole('button', { name: /insert into document/i }));
    fireEvent.click(screen.getByRole('button', { name: /replace selection/i }));

    await waitFor(() => {
      expect(wordHost.insertTextAtSelectionOrEnd).toHaveBeenCalledWith('Hermes summary');
      expect(wordHost.replaceSelection).toHaveBeenCalledWith('Hermes summary');
    });
  });

  it('disables selection quick actions when there is no current selection text', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn(),
      login: vi.fn(),
      getBridgeSession: vi.fn().mockResolvedValue({ authenticated: true, expiresAt: '2026-04-11T00:00:00.000Z' }),
      logout: vi.fn(),
    };
    const wordHost = {
      getAvailability: () => ({ available: true, reason: '' }),
      getSelectionText: vi.fn().mockResolvedValue(''),
      insertTextAtSelectionOrEnd: vi.fn().mockResolvedValue(undefined),
      replaceSelection: vi.fn().mockResolvedValue(undefined),
    };

    render(<App client={client as never} wordHost={wordHost} />);

    expect(await screen.findByText(/nothing selected in the document/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rewrite selection/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /expand selection/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /summarise selection/i })).toBeDisabled();
  });
});
