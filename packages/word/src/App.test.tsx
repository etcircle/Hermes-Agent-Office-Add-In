import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredSessionToken,
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

    expect(screen.getByRole('heading', { name: /unlock word/i })).toBeInTheDocument();
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

  it('shows a clear unavailable document state outside Office', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn().mockResolvedValue({ output_text: 'Hermes reply' }),
      login: vi.fn(),
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

    expect(screen.getByText(/word document actions are only available inside microsoft word/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh selection/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Draft a summary' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('Hermes reply')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /insert into document/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /replace selection/i })).toBeDisabled();
  });

  it('loads the current selection and applies the latest Hermes response to the document', async () => {
    setStoredSessionToken('session-1');

    const client = {
      chat: vi.fn().mockResolvedValue({ output_text: 'Hermes rewrite' }),
      login: vi.fn(),
    };
    const wordHost = {
      getAvailability: () => ({ available: true, reason: '' }),
      getSelectionText: vi.fn().mockResolvedValue('Selected draft'),
      insertTextAtSelectionOrEnd: vi.fn().mockResolvedValue(undefined),
      replaceSelection: vi.fn().mockResolvedValue(undefined),
    };

    render(<App client={client as never} wordHost={wordHost} />);

    expect(await screen.findByText('Selected draft')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Rewrite this' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('Hermes rewrite')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /insert into document/i }));
    fireEvent.click(screen.getByRole('button', { name: /replace selection/i }));

    await waitFor(() => {
      expect(wordHost.insertTextAtSelectionOrEnd).toHaveBeenCalledWith('Hermes rewrite');
      expect(wordHost.replaceSelection).toHaveBeenCalledWith('Hermes rewrite');
    });
  });
});