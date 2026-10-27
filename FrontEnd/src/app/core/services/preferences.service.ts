import { effect, Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

interface Preferences {
  theme: ThemeMode;
  realtimeToasts: boolean;
}

const KEY = 'k2.preferences';
const DEFAULTS: Preferences = { theme: 'light', realtimeToasts: true };

/** Preferências locais do usuário (tema e avisos), salvas no navegador. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly preferences = signal<Preferences>(this.load());

  constructor() {
    effect(() => {
      const prefs = this.preferences();
      document.documentElement.classList.toggle('dark', prefs.theme === 'dark');
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* armazenamento indisponível */ }
    });
  }

  update(patch: Partial<Preferences>): void {
    this.preferences.update((p) => ({ ...p, ...patch }));
  }

  private load(): Preferences {
    try {
      return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Preferences>) };
    } catch {
      return DEFAULTS;
    }
  }
}
