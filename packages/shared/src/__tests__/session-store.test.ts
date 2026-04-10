import { beforeEach, describe, expect, it } from 'vitest';
import {
  createOfficeChatStoreState,
  formatOfficeChatSessionTitle,
  getOfficeChatSessionPreview,
  loadOfficeChatStore,
  saveOfficeChatStore,
} from '../chat/session-store';

describe('office chat session store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a default session store when nothing is persisted yet', () => {
    const state = loadOfficeChatStore('word');

    expect(state.sessions).toHaveLength(1);
    expect(state.activeSessionId).toBe(state.sessions[0]?.id);
    expect(state.sessions[0]?.title).toBe('New chat');
  });

  it('persists and restores recent chat sessions in updated order', () => {
    const state = createOfficeChatStoreState('2026-04-10T10:00:00.000Z');
    const [firstSession] = state.sessions;
    const secondSession = {
      id: 'session-2',
      title: 'Second chat',
      createdAt: '2026-04-10T10:05:00.000Z',
      updatedAt: '2026-04-10T10:06:00.000Z',
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant' as const,
          content: 'Saved summary',
          createdAt: '2026-04-10T10:06:00.000Z',
          status: 'complete' as const,
        },
      ],
    };

    saveOfficeChatStore('word', {
      activeSessionId: secondSession.id,
      sessions: [firstSession, secondSession],
    });

    const restored = loadOfficeChatStore('word');
    expect(restored.activeSessionId).toBe('session-2');
    expect(restored.sessions.map((session) => session.id)).toEqual(['session-2', firstSession.id]);
  });

  it('builds sensible titles and previews from human input', () => {
    expect(formatOfficeChatSessionTitle('   Rewrite this very long proposal introduction into something tighter and clearer   ')).toBe(
      'Rewrite this very long proposal introduction into som…',
    );

    expect(
      getOfficeChatSessionPreview({
        id: 'session-1',
        title: 'New chat',
        createdAt: '2026-04-10T10:00:00.000Z',
        updatedAt: '2026-04-10T10:00:00.000Z',
        messages: [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: 'Hermes drafted a concise summary for the steering committee deck.',
            createdAt: '2026-04-10T10:01:00.000Z',
            status: 'complete',
          },
        ],
      }),
    ).toBe('Hermes drafted a concise summary for the steering committee deck.');
  });
});
