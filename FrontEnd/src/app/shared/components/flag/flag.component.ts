import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AppLang } from '../../../core/i18n/i18n-state';

/** Bandeira em SVG (emojis de bandeira não são exibidos no Windows). */
@Component({
  selector: 'k2-flag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flag.component.html',
  styleUrl: './flag.component.scss',
})
export class FlagComponent {
  readonly lang = input.required<AppLang>();
  readonly stripes = [0, 1, 2, 3, 4, 5, 6];
  readonly stars = [[2, 2], [5, 2], [8, 2], [10.5, 2], [3.5, 4.3], [6.5, 4.3], [9.5, 4.3], [2, 6.6], [5, 6.6], [8, 6.6], [10.5, 6.6], [3.5, 8.9], [6.5, 8.9], [9.5, 8.9]];
}
