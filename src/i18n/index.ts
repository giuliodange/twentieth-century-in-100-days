import { en, type UI } from './en.ts';

export const LOCALES = { en } satisfies Record<string, UI>;
export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = 'en';

/** UI strings for a locale. Only English exists for now. */
export function useUI(locale: Locale = DEFAULT_LOCALE): UI {
  return LOCALES[locale];
}
