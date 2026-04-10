import type { HostQuickAction } from '@hermes-agent-office/shared';

export interface WordSelectionContext {
  selectionText: string;
}

export type WordSelectionQuickActionId = 'rewrite-selection' | 'expand-selection' | 'summarise-selection';

export interface WordSelectionQuickAction extends HostQuickAction<WordSelectionContext> {
  id: WordSelectionQuickActionId;
}

export const wordSelectionQuickActions: readonly WordSelectionQuickAction[] = [
  {
    id: 'rewrite-selection',
    label: 'Rewrite selection',
    buildPrompt: ({ selectionText }) =>
      `Rewrite the following Word selection so it is clearer, smoother, and professionally polished while preserving the original meaning, tone, and factual details. Return only the rewritten text with no commentary or markdown.\n\nWord selection:\n"""\n${selectionText}\n"""`,
  },
  {
    id: 'expand-selection',
    label: 'Expand selection',
    buildPrompt: ({ selectionText }) =>
      `Expand the following Word selection into a fuller draft with more detail, clarity, and useful context while staying consistent with the original intent and tone. Return only the expanded text with no commentary or markdown.\n\nWord selection:\n"""\n${selectionText}\n"""`,
  },
  {
    id: 'summarise-selection',
    label: 'Summarise selection',
    buildPrompt: ({ selectionText }) =>
      `Summarise the following Word selection into a concise, accurate summary that preserves the key points and core intent. Return only the summary text with no commentary or markdown.\n\nWord selection:\n"""\n${selectionText}\n"""`,
  },
];
