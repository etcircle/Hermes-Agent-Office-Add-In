import type { HostAdapter } from '@hermes-agent-office/shared';
import type { WordHost } from './word-host';
import {
  wordSelectionQuickActions,
  type WordSelectionContext,
  type WordSelectionQuickAction,
} from './word-quick-actions';

export type WordResponseAction = 'insert-latest-response' | 'replace-selection';

export interface WordHostAdapter extends HostAdapter<WordSelectionContext, WordSelectionQuickAction, WordResponseAction> {
  applyResponse(response: string, action: WordResponseAction): Promise<void>;
}

export function createWordHostAdapter(wordHost: WordHost): WordHostAdapter {
  return {
    hostName: 'word',
    getAvailability: () => wordHost.getAvailability(),
    getContext: async () => ({
      selectionText: await wordHost.getSelectionText(),
    }),
    getQuickActions: () => wordSelectionQuickActions,
    async applyResponse(response, action) {
      switch (action) {
        case 'insert-latest-response':
          await wordHost.insertTextAtSelectionOrEnd(response);
          return;
        case 'replace-selection':
          await wordHost.replaceSelection(response);
          return;
        default:
          throw new Error(`Unsupported Word response action: ${action}`);
      }
    },
  };
}
