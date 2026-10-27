import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

/** Envoltório simples do Chart.js que reage a mudanças de configuração. */
@Component({
  selector: 'k2-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="wrap" [style.height.px]="height()"><canvas #canvas [attr.aria-label]="label()" role="img"></canvas></div>`,
  styles: `.wrap { position: relative; width: 100%; }`,
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  readonly height = input(240);
  /** Rótulo acessível, já traduzido por quem usa o componente. */
  readonly label = input('');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;
  private ready = false;

  constructor() {
    effect(() => {
      const config = this.config();
      if (this.ready) this.render(config);
    });
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.render(this.config());
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(config: ChartConfiguration): void {
    this.chart?.destroy();
    this.chart = new Chart(this.canvas().nativeElement, config);
  }
}

/** Lê uma variável CSS (para cores dos gráficos acompanharem o tema). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}
