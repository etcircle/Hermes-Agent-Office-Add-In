import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStoredSessionToken } from '@hermes-agent-office/shared';
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
});
