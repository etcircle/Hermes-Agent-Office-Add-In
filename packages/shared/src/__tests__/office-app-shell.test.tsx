import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeAppShell } from '../app/OfficeAppShell';

afterEach(() => {
  cleanup();
});

describe('OfficeAppShell', () => {
  it('renders the workspace tabs and switches between workspaces without losing state', () => {
    render(
      <OfficeAppShell
        productName="Hermes Agent"
        hostName="Word Add-in"
        workspaces={[
          {
            id: 'chat',
            label: 'Chat',
            content: <input aria-label="Chat draft" defaultValue="Remember me" />,
          },
          {
            id: 'research',
            label: 'Research',
            content: <div>Research workspace content</div>,
          },
          {
            id: 'visuals',
            label: 'Visuals',
            content: <div>Visuals workspace content</div>,
          },
        ]}
      />,
    );

    expect(screen.getByRole('tab', { name: /chat/i, selected: true })).toBeInTheDocument();
    const chatDraft = screen.getByLabelText('Chat draft');
    expect(chatDraft).toHaveValue('Remember me');
    fireEvent.change(chatDraft, { target: { value: 'Still here' } });

    fireEvent.click(screen.getByRole('tab', { name: /research/i }));

    expect(screen.getByRole('tab', { name: /research/i, selected: true })).toBeInTheDocument();
    expect(screen.getByText('Research workspace content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /chat/i }));
    expect(screen.getByLabelText('Chat draft')).toHaveValue('Still here');
  });

  it('moves focus when keyboard navigation changes tabs', () => {
    render(
      <OfficeAppShell
        productName="Hermes Agent"
        hostName="Word Add-in"
        workspaces={[
          {
            id: 'chat',
            label: 'Chat',
            content: <div>Chat workspace content</div>,
          },
          {
            id: 'research',
            label: 'Research',
            content: <div>Research workspace content</div>,
          },
        ]}
      />,
    );

    const chatTab = screen.getByRole('tab', { name: /chat/i });
    chatTab.focus();
    fireEvent.keyDown(chatTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: /research/i })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /research/i, selected: true })).toBeInTheDocument();
  });

  it('renders the logout action in the shared shell and calls it', () => {
    const onLogout = vi.fn();

    render(
      <OfficeAppShell
        productName="Hermes Agent"
        hostName="Word Add-in"
        onLogout={onLogout}
        workspaces={[
          {
            id: 'chat',
            label: 'Chat',
            content: <div>Chat workspace content</div>,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
