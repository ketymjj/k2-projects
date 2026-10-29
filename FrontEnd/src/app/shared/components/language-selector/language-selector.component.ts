import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppLang } from '../../../core/i18n/i18n-state';
import { I18nService, LANG_OPTIONS } from '../../../core/i18n/i18n.service';
import { FlagComponent } from '../flag/flag.component';

/** Seletor de idioma: troca imediata, sem recarregar a página. */
@Component({
  selector: 'k2-language-selector',
  imports: [MatButtonModule, MatMenuModule, MatIconModule, MatTooltipModule, TranslocoPipe, FlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.scss',
})
export class LanguageSelectorComponent {
  readonly i18n = inject(I18nService);
  readonly compact = input(false);
  readonly options = LANG_OPTIONS;
  readonly current = computed(() => LANG_OPTIONS.find((o) => o.code === this.i18n.lang()) ?? LANG_OPTIONS[0]);

  select(lang: AppLang): void {
    if (lang !== this.i18n.lang()) this.i18n.use(lang);
  }
}
