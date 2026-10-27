import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppLang } from '../../core/i18n/i18n-state';
import { I18nService, LANG_OPTIONS } from '../../core/i18n/i18n.service';

/** Bandeira em SVG (emojis de bandeira não são exibidos no Windows). */
@Component({
  selector: 'k2-flag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lang() === 'pt-BR') {
      <svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="3" fill="#229e45"/><path d="M14 3 25 10 14 17 3 10z" fill="#f8e509"/><circle cx="14" cy="10" r="4.2" fill="#2b49a3"/><path d="M10.1 9.2c2.6-.5 5.4.1 7.7 1.6" stroke="#fff" stroke-width=".8" fill="none"/></svg>
    } @else {
      <svg viewBox="0 0 28 20" aria-hidden="true"><defs><clipPath id="us-r"><rect width="28" height="20" rx="3"/></clipPath></defs><g clip-path="url(#us-r)"><rect width="28" height="20" fill="#fff"/><g fill="#d22f3c">@for (i of stripes; track i) {<rect [attr.y]="i * 3.08" width="28" height="1.54"/>}</g><rect width="12" height="10.8" fill="#2b3a8f"/><g fill="#fff">@for (s of stars; track $index) {<circle [attr.cx]="s[0]" [attr.cy]="s[1]" r=".55"/>}</g></g></svg>
    }
  `,
  styles: `:host { display: inline-flex; } svg { width: 22px; height: 16px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(0,0,0,.12); }`,
})
export class FlagComponent {
  readonly lang = input.required<AppLang>();
  readonly stripes = [0, 1, 2, 3, 4, 5, 6];
  readonly stars = [[2, 2], [5, 2], [8, 2], [10.5, 2], [3.5, 4.3], [6.5, 4.3], [9.5, 4.3], [2, 6.6], [5, 6.6], [8, 6.6], [10.5, 6.6], [3.5, 8.9], [6.5, 8.9], [9.5, 8.9]];
}

/** Seletor de idioma: troca imediata, sem recarregar a página. */
@Component({
  selector: 'k2-language-selector',
  imports: [MatButtonModule, MatMenuModule, MatIconModule, MatTooltipModule, TranslocoPipe, FlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="trigger" [class.compact]="compact()" [matMenuTriggerFor]="menu"
            [attr.aria-label]="'language.change' | transloco" [matTooltip]="'language.change' | transloco">
      <k2-flag [lang]="current().code" />
      <span class="code">{{ current().short }}</span>
      <mat-icon>expand_more</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      @for (o of options; track o.code) {
        <button mat-menu-item (click)="select(o.code)" [class.active]="o.code === i18n.lang()" role="menuitemradio" [attr.aria-checked]="o.code === i18n.lang()">
          <span class="option">
            <k2-flag [lang]="o.code" />
            <strong>{{ o.short }}</strong>
            <span>{{ o.nameKey | transloco }}</span>
            @if (o.code === i18n.lang()) { <mat-icon class="check">check</mat-icon> }
          </span>
        </button>
      }
    </mat-menu>
  `,
  styles: `
    .trigger { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 6px 0 10px; border-radius: 10px; cursor: pointer;
               border: 1px solid var(--k2-border); background: var(--k2-surface); color: var(--k2-text); font: inherit; font-weight: 600; font-size: 13px; }
    .trigger:hover { background: var(--k2-surface-hover); }
    .trigger mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--k2-text-muted); }
    .option { display: flex; align-items: center; gap: 10px; }
    .option span { color: var(--k2-text-2); }
    .check { color: var(--k2-primary); margin: 0 0 0 8px !important; }
    .active { background: var(--k2-primary-soft); }
    @media (max-width: 640px) { .trigger.compact .code { display: none; } }
  `,
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
