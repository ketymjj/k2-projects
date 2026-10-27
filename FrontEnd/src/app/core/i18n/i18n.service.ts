import { inject, Injectable } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AppLang, LANG_STORAGE_KEY, currentLang, registerTranslator, t } from './i18n-state';

export interface LangOption {
  code: AppLang;
  short: string;
  nameKey: string;
}

export const LANG_OPTIONS: LangOption[] = [
  { code: 'pt-BR', short: 'PT', nameKey: 'language.pt' },
  { code: 'en-US', short: 'EN', nameKey: 'language.en' },
];

/** Troca de idioma em tempo de execução, sem recarregar a página. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly transloco = inject(TranslocoService);
  private readonly dateAdapter = inject(DateAdapter<Date>);
  private readonly datepickerIntl = inject(MatDatepickerIntl);
  private readonly paginatorIntl = inject(MatPaginatorIntl);

  readonly lang = currentLang.asReadonly();

  constructor() {
    registerTranslator((key, params) => this.transloco.translate(key, params));
  }

  /** Carrega as traduções antes de ativar o idioma, para nunca exibir chaves na tela. */
  async use(lang: AppLang): Promise<void> {
    await firstValueFrom(this.transloco.load(lang));
    this.transloco.setActiveLang(lang);
    currentLang.set(lang);
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* armazenamento indisponível */ }
    document.documentElement.lang = lang;
    this.dateAdapter.setLocale(lang);
    this.updateMaterialIntl();
  }

  private updateMaterialIntl(): void {
    const d = this.datepickerIntl;
    d.calendarLabel = t('datepicker.calendar');
    d.openCalendarLabel = t('datepicker.open');
    d.closeCalendarLabel = t('datepicker.close');
    d.prevMonthLabel = t('datepicker.prevMonth');
    d.nextMonthLabel = t('datepicker.nextMonth');
    d.prevYearLabel = t('datepicker.prevYear');
    d.nextYearLabel = t('datepicker.nextYear');
    d.prevMultiYearLabel = t('datepicker.prevYears');
    d.nextMultiYearLabel = t('datepicker.nextYears');
    d.switchToMonthViewLabel = t('datepicker.chooseDate');
    d.switchToMultiYearViewLabel = t('datepicker.chooseMonthYear');
    d.changes.next();

    const p = this.paginatorIntl;
    p.itemsPerPageLabel = t('paginator.itemsPerPage');
    p.nextPageLabel = t('paginator.next');
    p.previousPageLabel = t('paginator.previous');
    p.firstPageLabel = t('paginator.first');
    p.lastPageLabel = t('paginator.last');
    p.getRangeLabel = (page, pageSize, length) => {
      if (length === 0) return t('paginator.range', { start: 0, end: 0, total: 0 });
      const start = page * pageSize;
      return t('paginator.range', { start: start + 1, end: Math.min(start + pageSize, length), total: length });
    };
    p.changes.next();
  }
}
