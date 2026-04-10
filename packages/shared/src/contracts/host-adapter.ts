export type OfficeHostName = 'word' | 'powerpoint' | 'outlook';

export interface HostAvailability {
  available: boolean;
  reason?: string;
}

export interface HostQuickAction<TContext = unknown> {
  id: string;
  label: string;
  buildPrompt(context: TContext): string;
}

export interface HostAdapter<
  TContext = unknown,
  TQuickAction extends HostQuickAction<TContext> = HostQuickAction<TContext>,
  TResponseAction extends string = string,
> {
  hostName: OfficeHostName;
  getAvailability(): HostAvailability;
  getContext(): Promise<TContext>;
  getQuickActions(): readonly TQuickAction[];
  applyResponse?(response: string, action: TResponseAction): Promise<void>;
}
