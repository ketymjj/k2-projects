import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'k2-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <div class="titles">
        <h1>{{ title() }}</h1>
        @if (subtitle()) { <p>{{ subtitle() }}</p> }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    p { margin: 4px 0 0; color: var(--k2-text-muted); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
