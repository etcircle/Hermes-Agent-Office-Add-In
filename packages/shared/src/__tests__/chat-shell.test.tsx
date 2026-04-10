import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatShell } from '../components/ChatShell';

describe('ChatShell', () => {
  it('sends the prompt and renders the Hermes response', async () => {
    const client = {
      chat: vi.fn().mockResolvedValue({ output_text: 'Hello from Hermes' }),
    };

    render(<ChatShell client={client as never} title="Hermes Agent for Word" />);

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Write me an intro' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(client.chat).toHaveBeenCalledWith('Write me an intro');
    });

    expect(await screen.findByText('Hello from Hermes')).toBeInTheDocument();
  });
});
