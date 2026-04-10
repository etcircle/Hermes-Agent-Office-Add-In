import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../components/LoginPage';

describe('LoginPage', () => {
  it('submits the passphrase and calls onSuccess with the returned token', async () => {
    const onSuccess = vi.fn();
    const client = {
      login: vi.fn().mockResolvedValue({ token: 'session-1', expiresAt: '2026-04-11T00:00:00.000Z' }),
    };

    render(<LoginPage client={client as never} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: 'super-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(client.login).toHaveBeenCalledWith('super-secret');
      expect(onSuccess).toHaveBeenCalledWith('session-1');
    });
  });
});
