import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'k2-loading',
  imports: [MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent {
  /** Texto já traduzido; quando ausente, usa "Carregando...". */
  readonly message = input<string>();
}
