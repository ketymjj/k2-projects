import { signal } from '@angular/core';

export type AppLang = 'pt-BR' | 'en-US';

export const SUPPORTED_LANGS: AppLang[] = ['pt-BR', 'en-US'];
export const DEFAULT_LANG: AppLang = 'pt-BR';
export const LANG_STORAGE_KEY = 'k2projects.language';

export function savedLang(): AppLang {
  try {
    const value = localStorage.getItem(LANG_STORAGE_KEY);
    return SUPPORTED_LANGS.includes(value as AppLang) ? (value as AppLang) : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/**
 * Idioma ativo como signal. Funções de formatação e tradução leem este signal,
 * então templates e computeds que as usam são recalculados quando o idioma muda.
 */
export const currentLang = signal<AppLang>(savedLang());

type Translator = (key: string, params?: Record<string, unknown>) => string;
let translator: Translator = (key) => key;

export function registerTranslator(fn: Translator): void {
  translator = fn;
}

/** Tradução para uso em código TypeScript (serviços, toasts, gráficos). */
export function t(key: string, params?: Record<string, unknown>): string {
  currentLang();
  return translator(key, params);
}

/** Indica se existe tradução para a chave (o Transloco devolve a própria chave quando não há). */
export function hasTranslation(key: string): boolean {
  return t(key) !== key;
}
