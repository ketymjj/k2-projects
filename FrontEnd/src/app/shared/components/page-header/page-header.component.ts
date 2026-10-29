import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'k2-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
