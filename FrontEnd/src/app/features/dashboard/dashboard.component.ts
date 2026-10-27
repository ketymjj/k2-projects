import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChartConfiguration } from 'chart.js';
import { t } from '../../core/i18n/i18n-state';
import { DashboardApi } from '../../core/services/api.services';
import { DataEventsService } from '../../core/services/data-events.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { AvatarComponent, PriorityBadgeComponent, ProjectStatusBadgeComponent } from '../../shared/components/badges.component';
import { ChartComponent, cssVar } from '../../shared/components/chart.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/components/states.component';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../shared/models/labels';
import { Dashboard, TaskItem } from '../../shared/models/models';
import { apiErrorMessage, formatDate, formatNumber, relativeDue } from '../../shared/utils';
import { TaskDialogsService } from '../tasks/task-dialogs.service';

interface Kpi { labelKey: string; value: number; icon: string; tone: string; }

@Component({
  selector: 'k2-dashboard',
  imports: [RouterLink, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressBarModule, TranslocoPipe, PageHeaderComponent, ChartComponent,
    LoadingComponent, ErrorStateComponent, EmptyStateComponent, AvatarComponent, PriorityBadgeComponent, ProjectStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <k2-page-header [title]="'dashboard.title' | transloco" [subtitle]="'dashboard.subtitle' | transloco">
        <button mat-stroked-button (click)="load()" [disabled]="loading()"><mat-icon>refresh</mat-icon> {{ 'common.refresh' | transloco }}</button>
      </k2-page-header>

      @if (loading() && !data()) {
        <k2-loading [message]="'dashboard.loading' | transloco" />
      } @else if (error() && !data()) {
        <div class="card"><k2-error [message]="errorText()" (retry)="load()" /></div>
      } @else if (data(); as d) {
        @if (loading()) { <mat-progress-bar mode="indeterminate" class="bar" /> }

        <div class="kpis">
          @for (k of kpis(); track k.labelKey) {
            <div class="card kpi">
              <span class="kpi-icon" [attr.data-tone]="k.tone"><mat-icon>{{ k.icon }}</mat-icon></span>
              <div>
                <div class="kpi-value">{{ num(k.value) }}</div>
                <div class="kpi-label">{{ k.labelKey | transloco }}</div>
              </div>
            </div>
          }
        </div>

        <div class="charts">
          <div class="card card-pad">
            <div class="card-title"><mat-icon>donut_large</mat-icon> {{ 'dashboard.charts.byStatus' | transloco }}</div>
            @if (d.totalTasks) {
              <div class="chart-with-legend">
                <k2-chart [config]="statusChart()" [height]="190" [label]="'dashboard.charts.byStatus' | transloco" />
                <ul class="legend">
                  @for (s of statusLegend(); track s.label) {
                    <li><i [style.background]="s.color"></i>{{ s.label }}<strong>{{ s.count }}</strong></li>
                  }
                </ul>
              </div>
            } @else { <k2-empty icon="donut_large" [title]="'dashboard.charts.noTasks' | transloco" /> }
          </div>
          <div class="card card-pad">
            <div class="card-title"><mat-icon>bar_chart</mat-icon> {{ 'dashboard.charts.byPriority' | transloco }}</div>
            @if (d.totalTasks) {
              <k2-chart [config]="priorityChart()" [height]="230" [label]="'dashboard.charts.byPriority' | transloco" />
            } @else { <k2-empty icon="bar_chart" [title]="'dashboard.charts.noTasks' | transloco" /> }
          </div>
          <div class="card card-pad">
            <div class="card-title"><mat-icon>stacked_bar_chart</mat-icon> {{ 'dashboard.charts.projectProgress' | transloco }}</div>
            @if (d.projectProgress.length) {
              <k2-chart [config]="progressChart()" [height]="230" [label]="'dashboard.charts.projectProgress' | transloco" />
            } @else { <k2-empty icon="folder_open" [title]="'dashboard.charts.noProjects' | transloco" /> }
          </div>
        </div>

        <div class="lists">
          <div class="card card-pad">
            <div class="card-title"><mat-icon>upcoming</mat-icon> {{ 'dashboard.lists.upcoming' | transloco }} <span class="spacer"></span><a routerLink="/my-tasks" class="small">{{ 'common.viewAll' | transloco }}</a></div>
            @for (task of d.myUpcomingTasks; track task.id) {
              <button class="item" (click)="openTask(task)">
                <span class="item-main"><strong>{{ task.title }}</strong><span class="muted small">{{ task.projectName }}</span></span>
                <span class="item-side">
                  <k2-priority [priority]="task.priority" />
                  <span class="small" [class.text-danger]="task.isOverdue">{{ rel(task.dueDate) }}</span>
                </span>
              </button>
            } @empty { <k2-empty icon="task_alt" [title]="'dashboard.lists.noPending' | transloco" [message]="'dashboard.lists.noPendingMessage' | transloco" /> }
          </div>

          <div class="card card-pad">
            <div class="card-title"><mat-icon class="danger-icon">alarm</mat-icon> {{ 'dashboard.lists.overdue' | transloco }}</div>
            @for (task of d.overdueTaskList; track task.id) {
              <button class="item" (click)="openTask(task)">
                <span class="item-main"><strong>{{ task.title }}</strong><span class="muted small">{{ task.projectName }} · {{ 'dashboard.lists.dueOn' | transloco: { date: fmt(task.dueDate) } }}</span></span>
                <k2-avatar [name]="task.assignedToName" [size]="28" [tooltip]="true" />
              </button>
            } @empty { <k2-empty icon="verified" [title]="'dashboard.lists.noOverdue' | transloco" /> }
          </div>

          <div class="card card-pad">
            <div class="card-title"><mat-icon>history</mat-icon> {{ 'dashboard.lists.recent' | transloco }} <span class="spacer"></span><a routerLink="/projects" class="small">{{ 'common.viewAllMasc' | transloco }}</a></div>
            @for (p of d.recentProjects; track p.id) {
              <button class="item" (click)="openProject(p.id)">
                <span class="item-main">
                  <strong>{{ p.name }}</strong>
                  <span class="prog"><span class="progress"><span [style.width.%]="p.progress"></span></span><span class="small">{{ p.progress }}%</span></span>
                </span>
                <k2-project-status [status]="p.status" />
              </button>
            } @empty { <k2-empty icon="folder_open" [title]="'dashboard.lists.noProjects' | transloco" /> }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .bar { margin-bottom: 12px; border-radius: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .kpi { padding: 16px 18px; display: flex; align-items: center; gap: 14px; }
    .kpi-icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; }
    .kpi-icon[data-tone='blue'] { background: var(--k2-primary-soft); color: var(--k2-primary); }
    .kpi-icon[data-tone='violet'] { background: var(--k2-violet-soft); color: var(--k2-violet); }
    .kpi-icon[data-tone='orange'] { background: color-mix(in srgb, var(--k2-status-todo) 14%, transparent); color: var(--k2-status-todo); }
    .kpi-icon[data-tone='green'] { background: var(--k2-success-soft); color: var(--k2-success); }
    .kpi-icon[data-tone='red'] { background: var(--k2-danger-soft); color: var(--k2-danger); }
    .kpi-value { font-size: 26px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; }
    .kpi-label { color: var(--k2-text-muted); font-size: 13px; }
    .charts { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 16px; margin-bottom: 20px; }
    .chart-with-legend { display: flex; flex-direction: column; gap: 12px; }
    .legend { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 18px; font-size: 13px; color: var(--k2-text-2); }
    .legend li { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
    .legend i { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
    .legend strong { color: var(--k2-text); }
    .lists { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .charts > *, .lists > * { min-width: 0; }
    .item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 8px; border: 0; border-bottom: 1px solid var(--k2-border); background: none; cursor: pointer; text-align: left; font: inherit; color: inherit; border-radius: 8px; }
    .item:last-of-type { border-bottom: 0; }
    .item:hover { background: var(--k2-surface-hover); }
    .item-main { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .item-main strong { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .prog { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .prog .progress { flex: 1; max-width: 160px; }
    .danger-icon { color: var(--k2-danger) !important; }
    @media (max-width: 1200px) { .charts { grid-template-columns: 1fr 1fr; } .lists { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 760px) {
      .charts, .lists { grid-template-columns: 1fr; }
      .kpis { grid-template-columns: 1fr 1fr; gap: 10px; }
      .kpi { padding: 12px; gap: 10px; }
      .kpi-icon { width: 36px; height: 36px; }
      .kpi-value { font-size: 22px; }
    }
  `,
})
export class DashboardComponent {
  private readonly api = inject(DashboardApi);
  private readonly router = inject(Router);
  private readonly dialogs = inject(TaskDialogsService);
  private readonly prefs = inject(PreferencesService);

  readonly data = signal<Dashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly fmt = formatDate;
  readonly rel = relativeDue;
  readonly num = formatNumber;
  /** Incrementado ao trocar o tema para recalcular as cores dos gráficos. */
  private readonly themeTick = signal(0);

  readonly kpis = computed<Kpi[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { labelKey: 'dashboard.kpis.totalProjects', value: d.totalProjects, icon: 'folder', tone: 'blue' },
      { labelKey: 'dashboard.kpis.projectsInProgress', value: d.projectsInProgress, icon: 'play_circle', tone: 'violet' },
      { labelKey: 'dashboard.kpis.totalTasks', value: d.totalTasks, icon: 'checklist', tone: 'blue' },
      { labelKey: 'dashboard.kpis.pendingTasks', value: d.pendingTasks, icon: 'radio_button_unchecked', tone: 'orange' },
      { labelKey: 'dashboard.kpis.inProgressTasks', value: d.inProgressTasks, icon: 'timelapse', tone: 'violet' },
      { labelKey: 'dashboard.kpis.completedTasks', value: d.completedTasks, icon: 'task_alt', tone: 'green' },
      { labelKey: 'dashboard.kpis.overdueTasks', value: d.overdueTasks, icon: 'alarm', tone: 'red' },
    ];
  });

  readonly statusLegend = computed(() => {
    this.themeTick();
    const d = this.data();
    return TASK_STATUSES.map((s) => ({
      label: t(s.labelKey),
      color: cssVar(s.color.slice(4, -1)),
      count: d?.tasksByStatus.find((x) => x.key === s.value)?.count ?? 0,
    }));
  });

  readonly statusChart = computed<ChartConfiguration>(() => {
    const legend = this.statusLegend();
    return {
      type: 'doughnut',
      data: {
        labels: legend.map((l) => l.label),
        datasets: [{ data: legend.map((l) => l.count), backgroundColor: legend.map((l) => l.color), borderColor: cssVar('--k2-surface'), borderWidth: 2, hoverOffset: 4 }],
      },
      options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
    };
  });

  readonly priorityChart = computed<ChartConfiguration>(() => {
    this.themeTick();
    const d = this.data();
    const colors = TASK_PRIORITIES.map((p) => cssVar(p.color.slice(4, -1)));
    return {
      type: 'bar',
      data: {
        labels: TASK_PRIORITIES.map((p) => t(p.labelKey)),
        datasets: [{
          label: t('dashboard.charts.tasksSeries'),
          data: TASK_PRIORITIES.map((p) => d?.tasksByPriority.find((x) => x.key === p.value)?.count ?? 0),
          backgroundColor: colors, borderRadius: 4, maxBarThickness: 36,
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar('--k2-text-2') } },
          y: { beginAtZero: true, ticks: { precision: 0, color: cssVar('--k2-text-muted') }, grid: { color: cssVar('--k2-border') }, border: { display: false } },
        },
      },
    };
  });

  readonly progressChart = computed<ChartConfiguration>(() => {
    this.themeTick();
    const items = this.data()?.projectProgress ?? [];
    return {
      type: 'bar',
      data: {
        labels: items.map((p) => p.name),
        datasets: [{
          label: t('dashboard.charts.progressSeries'),
          data: items.map((p) => p.progress),
          backgroundColor: cssVar('--k2-status-doing'), borderRadius: 4, maxBarThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => { const p = items[ctx.dataIndex]; return ` ${t('dashboard.charts.progressTooltip', { progress: p.progress, done: p.completedTaskCount, total: p.taskCount })}`; } } },
        },
        scales: {
          x: { min: 0, max: 100, ticks: { callback: (v) => `${v}%`, color: cssVar('--k2-text-muted') }, grid: { color: cssVar('--k2-border') }, border: { display: false } },
          y: { grid: { display: false }, ticks: { color: cssVar('--k2-text-2') } },
        },
      },
    };
  });

  constructor() {
    this.load();
    inject(DataEventsService).changes().pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.load());
    effect(() => {
      this.prefs.preferences().theme;
      setTimeout(() => this.themeTick.update((n) => n + 1));
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.error.set(e); },
    });
  }

  errorText(): string {
    return apiErrorMessage(this.error(), 'errors.loadDashboard');
  }

  openTask(task: TaskItem): void { this.dialogs.openDetail(task.id); }
  openProject(id: string): void { this.router.navigate(['/projects', id]); }
}
