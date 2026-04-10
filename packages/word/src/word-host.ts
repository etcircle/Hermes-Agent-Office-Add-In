export interface WordHostAvailability {
  available: boolean;
  reason: string;
}

export interface WordHost {
  getAvailability(): WordHostAvailability;
  getSelectionText(): Promise<string>;
  insertTextAtSelectionOrEnd(text: string): Promise<void>;
  replaceSelection(text: string): Promise<void>;
}

interface WordSelection {
  text: string;
  load(property: 'text'): void;
  insertText(text: string, location: string): void;
}

interface WordBody {
  insertText(text: string, location: string): void;
}

interface WordContext {
  document: {
    body: WordBody;
    getSelection(): WordSelection;
  };
  sync(): Promise<void>;
}

interface WordRuntime {
  InsertLocation: {
    after: string;
    end: string;
    replace: string;
  };
  run<T>(callback: (context: WordContext) => Promise<T>): Promise<T>;
}

interface CreateWordHostOptions {
  office?: unknown;
  word?: WordRuntime;
}

const UNAVAILABLE_REASON = 'Word document actions are only available inside Microsoft Word.';

export function createWordHost(options: CreateWordHostOptions = {}): WordHost {
  function getOffice(): unknown {
    return options.office ?? getGlobalValue('Office');
  }

  function getWord(): WordRuntime | undefined {
    return options.word ?? getGlobalValue<WordRuntime>('Word');
  }

  function getAvailability(): WordHostAvailability {
    const office = getOffice();
    const word = getWord();

    if (!office || !word || typeof word.run !== 'function' || !word.InsertLocation) {
      return {
        available: false,
        reason: UNAVAILABLE_REASON,
      };
    }

    return {
      available: true,
      reason: '',
    };
  }

  function requireWord(): WordRuntime {
    const word = getWord();

    if (!getAvailability().available || !word) {
      throw new Error(UNAVAILABLE_REASON);
    }

    return word;
  }

  return {
    getAvailability,
    async getSelectionText() {
      const runtime = requireWord();

      return runtime.run(async (context) => {
        const selection = context.document.getSelection();
        selection.load('text');
        await context.sync();
        return selection.text.trim();
      });
    },
    async insertTextAtSelectionOrEnd(text: string) {
      const runtime = requireWord();

      await runtime.run(async (context) => {
        const selection = context.document.getSelection();
        selection.load('text');
        await context.sync();

        if (selection.text.trim()) {
          selection.insertText(text, runtime.InsertLocation.after);
        } else {
          context.document.body.insertText(text, runtime.InsertLocation.end);
        }

        await context.sync();
      });
    },
    async replaceSelection(text: string) {
      const runtime = requireWord();

      await runtime.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertText(text, runtime.InsertLocation.replace);
        await context.sync();
      });
    },
  };
}

function getGlobalValue<T>(key: string): T | undefined {
  return (globalThis as Record<string, T | undefined>)[key];
}