import { describe, expect, it, vi } from 'vitest';
import { createWordHost } from './word-host';

function createMockWordRuntime(selectionText: string) {
  const selection = {
    text: selectionText,
    load: vi.fn(),
    insertText: vi.fn(),
  };

  const body = {
    insertText: vi.fn(),
  };

  const context = {
    document: {
      body,
      getSelection: vi.fn(() => selection),
    },
    sync: vi.fn().mockResolvedValue(undefined),
  };

  const word = {
    InsertLocation: {
      after: 'After',
      end: 'End',
      replace: 'Replace',
    },
    run: vi.fn(async (callback: (value: typeof context) => Promise<unknown>) => callback(context)),
  };

  return {
    selection,
    body,
    context,
    word,
  };
}

describe('createWordHost', () => {
  it('reports a clear unavailable state when Office.js is missing', () => {
    const host = createWordHost({ office: undefined, word: undefined });

    expect(host.getAvailability()).toEqual({
      available: false,
      reason: 'Word document actions are only available inside Microsoft Word.',
    });
  });

  it('reads the current Word selection text when Word is available', async () => {
    const runtime = createMockWordRuntime('Selected draft');
    const host = createWordHost({ office: {}, word: runtime.word });

    await expect(host.getSelectionText()).resolves.toBe('Selected draft');
    expect(runtime.selection.load).toHaveBeenCalledWith('text');
    expect(runtime.context.sync).toHaveBeenCalled();
  });

  it('inserts after the current selection when text is selected', async () => {
    const runtime = createMockWordRuntime('Selected draft');
    const host = createWordHost({ office: {}, word: runtime.word });

    await host.insertTextAtSelectionOrEnd('Hermes reply');

    expect(runtime.selection.insertText).toHaveBeenCalledWith('Hermes reply', 'After');
    expect(runtime.body.insertText).not.toHaveBeenCalled();
  });

  it('inserts at the end of the document when no text is selected', async () => {
    const runtime = createMockWordRuntime('   ');
    const host = createWordHost({ office: {}, word: runtime.word });

    await host.insertTextAtSelectionOrEnd('Hermes reply');

    expect(runtime.body.insertText).toHaveBeenCalledWith('Hermes reply', 'End');
    expect(runtime.selection.insertText).not.toHaveBeenCalled();
  });

  it('replaces the current selection with the provided text', async () => {
    const runtime = createMockWordRuntime('Selected draft');
    const host = createWordHost({ office: {}, word: runtime.word });

    await host.replaceSelection('Hermes rewrite');

    expect(runtime.selection.insertText).toHaveBeenCalledWith('Hermes rewrite', 'Replace');
  });
});