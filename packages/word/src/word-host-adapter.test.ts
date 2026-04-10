import { describe, expect, it, vi } from 'vitest';
import { createWordHostAdapter } from './word-host-adapter';

describe('createWordHostAdapter', () => {
  it('exposes the Word host contract and delegates context reads to the Word host', async () => {
    const wordHost = {
      getAvailability: vi.fn(() => ({ available: true, reason: '' })),
      getSelectionText: vi.fn().mockResolvedValue('Selected draft'),
      insertTextAtSelectionOrEnd: vi.fn().mockResolvedValue(undefined),
      replaceSelection: vi.fn().mockResolvedValue(undefined),
    };

    const adapter = createWordHostAdapter(wordHost);

    expect(adapter.hostName).toBe('word');
    expect(adapter.getAvailability()).toEqual({ available: true, reason: '' });
    expect(await adapter.getContext()).toEqual({ selectionText: 'Selected draft' });
    expect(adapter.getQuickActions().map((action) => action.id)).toEqual([
      'rewrite-selection',
      'expand-selection',
      'summarise-selection',
    ]);
  });

  it('applies latest responses through explicit Word response actions', async () => {
    const wordHost = {
      getAvailability: vi.fn(() => ({ available: true, reason: '' })),
      getSelectionText: vi.fn().mockResolvedValue('Selected draft'),
      insertTextAtSelectionOrEnd: vi.fn().mockResolvedValue(undefined),
      replaceSelection: vi.fn().mockResolvedValue(undefined),
    };

    const adapter = createWordHostAdapter(wordHost);

    await adapter.applyResponse('Hermes output', 'insert-latest-response');
    await adapter.applyResponse('Hermes rewrite', 'replace-selection');

    expect(wordHost.insertTextAtSelectionOrEnd).toHaveBeenCalledWith('Hermes output');
    expect(wordHost.replaceSelection).toHaveBeenCalledWith('Hermes rewrite');
  });

  it('rejects unsupported Word response actions', async () => {
    const adapter = createWordHostAdapter({
      getAvailability: () => ({ available: true, reason: '' }),
      getSelectionText: vi.fn().mockResolvedValue('Selected draft'),
      insertTextAtSelectionOrEnd: vi.fn().mockResolvedValue(undefined),
      replaceSelection: vi.fn().mockResolvedValue(undefined),
    });

    await expect(adapter.applyResponse('Hermes output', 'bad-action' as never)).rejects.toThrow(
      /unsupported word response action/i,
    );
  });
});
