import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { currentLang } from '../../core/i18n/i18n-state';
import { ProjectsApi, TasksApi, UsersApi } from '../../core/services/api.services';
import { DataEventsService } from '../../core/services/data-events.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TASK_PRIORITIES, optionOf } from '../../shared/models/labels';
import { ProjectLookup, TaskItem, UserLookup } from '../../shared/models/models';
import { addDays, capitalize, formatWith, toIsoDate, todayIso } from '../../shared/utils';
import { TaskDialogsService } from '../tasks/task-dialogs.service';

type View = 'month' | 'week';

interface Day {
  date: Date;
  iso: string;
  inPeriod: boolean;
  isToday: boolean;
  tasks: TaskItem[];
}

@Component({
  selector: 'k2-calendar',
  imports: [FormsModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatSelectModule, MatIconModule,
    MatTooltipModule, MatProgressBarModule, TranslocoPipe, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent {
  readonly auth = inject(AuthService);
  private readonly tasksApi = inject(TasksApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(TaskDialogsService);

  readonly priorities = TASK_PRIORITIES;
  readonly view = signal<View>('month');
  readonly cursor = signal(new Date());
  readonly projects = signal<ProjectLookup[]>([]);
  readonly users = signal<UserLookup[]>([]);
  readonly projectId = signal<string | null>(null);
  readonly assigneeId = signal<string | null>(null);
  readonly tasks = signal<TaskItem[]>([]);
  readonly loading = signal(false);
  private readonly expanded = signal<Set<string>>(new Set());

  /** Nomes curtos dos dias da semana (domingo primeiro) no idioma ativo. */
  readonly weekdays = computed(() => {
    currentLang();
    const sunday = new Date(2026, 0, 4); // um domingo qualquer
    return Array.from({ length: 7 }, (_, i) => formatWith(addDays(sunday, i), { weekday: 'short' }).replace('.', ''));
  });

  /** Intervalo exibido: mês completo (semanas cheias) ou a semana do cursor. */
  readonly range = computed(() => {
    const c = this.cursor();
    if (this.view() === 'week') {
      const start = addDays(new Date(c.getFullYear(), c.getMonth(), c.getDate()), -c.getDay());
      return { start, end: addDays(start, 6) };
    }
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const last = new Date(c.getFullYear(), c.getMonth() + 1, 0);
    return { start: addDays(first, -first.getDay()), end: addDays(last, 6 - last.getDay()) };
  });

  readonly periodLabel = computed(() => {
    currentLang();
    const c = this.cursor();
    if (this.view() === 'month') return capitalize(formatWith(c, { month: 'long', year: 'numeric' }));
    const { start, end } = this.range();
    return `${formatWith(start, { day: '2-digit', month: 'short' })} – ${formatWith(end, { day: '2-digit', month: 'short', year: 'numeric' })}`;
  });

  readonly days = computed<Day[]>(() => {
    const { start, end } = this.range();
    const month = this.cursor().getMonth();
    const today = todayIso();
    const byDate = new Map<string, TaskItem[]>();
    for (const task of this.tasks()) {
      if (!task.dueDate) continue;
      const key = task.dueDate.substring(0, 10);
      byDate.set(key, [...(byDate.get(key) ?? []), task]);
    }
    const result: Day[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const iso = toIsoDate(d)!;
      result.push({ date: d, iso, inPeriod: this.view() === 'week' || d.getMonth() === month, isToday: iso === today, tasks: byDate.get(iso) ?? [] });
    }
    return result;
  });

  constructor() {
    inject(ProjectsApi).lookup().subscribe({ next: (p) => this.projects.set(p), error: () => undefined });
    inject(UsersApi).lookup().subscribe({ next: (u) => this.users.set(u), error: () => undefined });
    inject(DataEventsService).changes().pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.load());
    this.load();
  }

  shortMonth(date: Date): string {
    return formatWith(date, { month: 'short' });
  }

  load(): void {
    const { start, end } = this.range();
    this.loading.set(true);
    this.tasksApi.list({
      dueFrom: toIsoDate(start)!, dueTo: toIsoDate(end)!,
      projectId: this.projectId() ?? undefined, assignedToId: this.assigneeId() ?? undefined,
      pageSize: 500, sortBy: 'priority',
    }).subscribe({
      next: (page) => { this.tasks.set(page.items); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.toast.error(e, 'errors.loadCalendar'); },
    });
  }

  setView(view: View): void {
    this.view.set(view);
    this.load();
  }

  move(step: number): void {
    const c = this.cursor();
    this.cursor.set(this.view() === 'month' ? new Date(c.getFullYear(), c.getMonth() + step, 1) : addDays(c, 7 * step));
    this.load();
  }

  goToday(): void {
    this.cursor.set(new Date());
    this.load();
  }

  private limit(): number {
    return this.view() === 'week' ? 50 : 3;
  }

  visibleTasks(day: Day): TaskItem[] {
    return this.expanded().has(day.iso) ? day.tasks : day.tasks.slice(0, this.limit());
  }

  hiddenCount(day: Day): number {
    return this.expanded().has(day.iso) ? 0 : Math.max(0, day.tasks.length - this.limit());
  }

  expand(iso: string): void {
    this.expanded.update((s) => new Set(s).add(iso));
  }

  prioColor(task: TaskItem): string {
    return optionOf(TASK_PRIORITIES, task.priority)?.color ?? 'gray';
  }

  open(task: TaskItem): void {
    this.dialogs.openDetail(task.id);
  }

  create(dueDate?: string): void {
    this.dialogs.openForm({ dueDate, projectId: this.projectId() ?? undefined });
  }
}
