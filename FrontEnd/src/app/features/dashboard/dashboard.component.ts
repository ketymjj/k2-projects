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
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PriorityBadgeComponent } from '../../shared/components/priority-badge/priority-badge.component';
import { ProjectStatusBadgeComponent } from '../../shared/components/project-status-badge/project-status-badge.component';
import { ChartComponent, cssVar } from '../../shared/components/chart/chart.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
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
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
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
