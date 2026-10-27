import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'k2-loading',
  imports: [MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="state"><mat-spinner diameter="36" /><span>{{ message() ?? ('states.loading' | transloco) }}</span></div>`,
  styles: `.state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 16px; color: var(--k2-text-muted); }`,
})
export class LoadingComponent {
  /** Texto já traduzido; quando ausente, usa "Carregando...". */
  readonly message = input<string>();
}

@Component({
  selector: 'k2-empty',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state">
      <div class="icon"><mat-icon>{{ icon() }}</mat-icon></div>
      <strong>{{ title() ?? ('states.emptyTitle' | transloco) }}</strong>
      @if (message()) { <span>{{ message() }}</span> }
      <ng-content />
    </div>
  `,
  styles: `
    .state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 16px; text-align: center; color: var(--k2-text-muted); }
    .icon { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: var(--k2-primary-soft); color: var(--k2-primary); margin-bottom: 4px; }
    strong { color: var(--k2-text); font-size: 15px; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input<string>();
  readonly message = input<string>();
}

@Component({
  selector: 'k2-error',
  imports: [MatIconModule, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state">
      <mat-icon>error_outline</mat-icon>
      <strong>{{ message() ?? ('states.errorLoad' | transloco) }}</strong>
      <button mat-stroked-button (click)="retry.emit()"><mat-icon>refresh</mat-icon> {{ 'common.retry' | transloco }}</button>
    </div>
  `,
  styles: `
    .state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 16px; text-align: center; color: var(--k2-danger); }
    strong { color: var(--k2-text); font-weight: 500; }
  `,
})
export class ErrorStateComponent {
  readonly message = input<string>();
  readonly retry = output<void>();
}
