export const OFFICE_ADDIN_DEFAULTS = {
  httpPort: 3300,
  httpsPort: 3445,
  apiBaseUrl: 'http://127.0.0.1:8642',
} as const;

export type OfficeAppId = 'word' | 'powerpoint' | 'excel' | 'outlook';
