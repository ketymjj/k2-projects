import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { toObservable } from '@angular/core/rxjs-interop';
import { skip } from 'rxjs';
import { currentLang, t } from './i18n-state';

/** Carrega public/i18n/{lang}.json. */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`i18n/${lang}.json`);
  }
}

/** Título da aba do navegador traduzido; a rota guarda a chave de tradução em "title". */
@Injectable()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private lastKey: string | undefined;

  constructor() {
    super();
    toObservable(currentLang).pipe(skip(1)).subscribe(() => this.apply());
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.lastKey = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    this.title.setTitle(this.lastKey ? `${t(this.lastKey)} · K2 Projects` : 'K2 Projects');
  }
}

/**
 * Adaptador de datas que entende a digitação no formato do idioma:
 * dd/MM/aaaa em português e MM/dd/aaaa em inglês.
 */
@Injectable()
export class LocaleDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const match = value.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
      if (match) {
        const [a, b, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
        const [day, month] = currentLang() === 'en-US' ? [b, a] : [a, b];
        const date = new Date(year, month - 1, day);
        return date.getMonth() === month - 1 && date.getDate() === day ? date : this.invalid();
      }
    }
    return super.parse(value, parseFormat);
  }
}
