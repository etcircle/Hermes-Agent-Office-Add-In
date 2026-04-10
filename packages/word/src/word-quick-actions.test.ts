import { describe, expect, it } from 'vitest';
import { wordSelectionQuickActions } from './word-quick-actions';

describe('wordSelectionQuickActions', () => {
  it('defines the expected Word selection quick actions', () => {
    expect(wordSelectionQuickActions.map((action) => action.id)).toEqual([
      'rewrite-selection',
      'expand-selection',
      'summarise-selection',
    ]);

    expect(wordSelectionQuickActions.map((action) => action.label)).toEqual([
      'Rewrite selection',
      'Expand selection',
      'Summarise selection',
    ]);
  });

  it('builds focused prompts from the current selection context', () => {
    const selectionText = 'Selected draft';
    const prompts = wordSelectionQuickActions.map((action) => action.buildPrompt({ selectionText }));

    expect(prompts[0]).toMatch(/rewrite/i);
    expect(prompts[1]).toMatch(/expand/i);
    expect(prompts[2]).toMatch(/summari[sz]e/i);

    for (const prompt of prompts) {
      expect(prompt).toContain('Selected draft');
      expect(prompt).toContain('Word selection');
    }
  });
});
