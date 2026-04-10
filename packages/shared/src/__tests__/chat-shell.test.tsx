import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatShell, type ChatShellResponseActions } from '../components/ChatShell';

describe('ChatShell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('sends the prompt, renders the Hermes response, and stores it as a recent session', async () => {
    const client = {
      chat: vi.fn().mockResolvedValue({ output_text: 'Hello from Hermes' }),
    };

    render(<ChatShell client={client as never} title="Hermes Agent for Word" sessionStoreNamespace="word" />);

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Write me an intro' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(client.chat).toHaveBeenCalledWith('Write me an intro');
    });

    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Hello from Hermes')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /write me an intro/i })).toBeInTheDocument();
  });

  it('supports response actions and restores earlier sessions from the recent-session list', async () => {
    const client = {
      chat: vi
        .fn()
        .mockResolvedValueOnce({ output_text: 'Expanded selection' })
        .mockResolvedValueOnce({ output_text: 'Fresh draft' }),
    };

    render(
      <ChatShell
        client={client as never}
        title="Hermes Agent for Word"
        sessionStoreNamespace="word"
        renderResponseActions={(shell: ChatShellResponseActions) => (
          <button
            type="button"
            onClick={() =>
              void shell.generateResponse({
                prompt: 'Expand this selection',
                displayInput: 'Expand selection\n\nSelected draft',
              })
            }
          >
            Expand selection
          </button>
        )}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^expand selection$/i }));
    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Expanded selection')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /expand selection selected draft/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));
    expect(screen.getByText(/start a new chat here/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Fresh brief' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Fresh draft')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /expand selection selected draft/i }));
    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Expanded selection')).toBeInTheDocument();
    });
  });

  it('updates the transcript as streaming chunks arrive', async () => {
    const client = {
      chat: vi.fn(),
      streamChat: vi.fn(async function* () {
        yield { type: 'delta' as const, delta: 'Hello' };
        await Promise.resolve();
        yield { type: 'delta' as const, delta: ' from Hermes' };
        yield { type: 'done' as const, outputText: 'Hello from Hermes' };
      }),
    };

    render(<ChatShell client={client as never} title="Hermes Agent for Word" sessionStoreNamespace="word" />);

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Write me an intro' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(within(screen.getByLabelText(/conversation transcript/i)).getByText('Hello from Hermes')).toBeInTheDocument();
    });
    expect(client.streamChat).toHaveBeenCalledWith('Write me an intro');
  });
});
