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
import { PageHeaderComponent } from '../../shared/components/page-header.component';
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
  template: `
    <div class="page">
      <k2-page-header [title]="'calendar.title' | transloco" [subtitle]="'calendar.subtitle' | transloco">
        @if (auth.canCreateProjects()) {
          <button mat-flat-button class="btn-gradient" (click)="create()"><mat-icon>add</mat-icon> {{ 'tasks.new' | transloco }}</button>
        }
      </k2-page-header>

      <div class="card">
        <div class="cal-toolbar">
          <div class="nav">
            <button mat-icon-button (click)="move(-1)" [attr.aria-label]="'calendar.previous' | transloco"><mat-icon>chevron_left</mat-icon></button>
            <button mat-stroked-button (click)="goToday()">{{ 'common.today' | transloco }}</button>
            <button mat-icon-button (click)="move(1)" [attr.aria-label]="'calendar.next' | transloco"><mat-icon>chevron_right</mat-icon></button>
            <h2>{{ periodLabel() }}</h2>
          </div>
          <span class="spacer"></span>
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>{{ 'common.project' | transloco }}</mat-label>
            <mat-select [ngModel]="projectId()" (ngModelChange)="projectId.set($event); load()">
              <mat-option [value]="null">{{ 'common.all' | transloco }}</mat-option>
              @for (p of projects(); track p.id) { <mat-option [value]="p.id">{{ p.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>{{ 'common.assignee' | transloco }}</mat-label>
            <mat-select [ngModel]="assigneeId()" (ngModelChange)="assigneeId.set($event); load()">
              <mat-option [value]="null">{{ 'common.all' | transloco }}</mat-option>
              @for (u of users(); track u.id) { <mat-option [value]="u.id">{{ u.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-button-toggle-group [value]="view()" (change)="setView($event.value)" hideSingleSelectionIndicator>
            <mat-button-toggle value="month">{{ 'calendar.monthly' | transloco }}</mat-button-toggle>
            <mat-button-toggle value="week">{{ 'calendar.weekly' | transloco }}</mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <div class="legend small">
          @for (p of priorities; track p.value) { <span><i [style.background]="p.color"></i>{{ p.labelKey | transloco }}</span> }
          <span><mat-icon class="late-icon">alarm</mat-icon>{{ 'calendar.overdue' | transloco }}</span>
          <span class="muted">· {{ 'calendar.tasksInPeriod' | transloco: { count: tasks().length } }}</span>
        </div>

        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

        <div class="weekdays" [class.week]="view() === 'week'">
          @for (w of weekdays(); track $index) { <div>{{ w }}</div> }
        </div>
        <div class="grid" [class.week]="view() === 'week'">
          @for (day of days(); track day.iso) {
            <div class="day" [class.out]="!day.inPeriod" [class.today]="day.isToday">
              <div class="day-head">
                <span class="num">{{ day.date.getDate() }}</span>
                @if (view() === 'week') { <span class="muted small">{{ shortMonth(day.date) }}</span> }
                <span class="spacer"></span>
                @if (auth.canCreateProjects()) {
                  <button class="add" (click)="create(day.iso)" [matTooltip]="'calendar.newOnDate' | transloco" [attr.aria-label]="'calendar.newOnDate' | transloco"><mat-icon>add</mat-icon></button>
                }
              </div>
              <div class="items">
                @for (task of visibleTasks(day); track task.id) {
                  <button class="chip" [style.--c]="prioColor(task)" [class.overdue]="task.isOverdue" [class.done]="task.status === 'Concluido'"
                          (click)="open(task)" [matTooltip]="task.projectName + ' · ' + (task.assignedToName ?? ('common.noAssignee' | transloco))">
                    @if (task.isOverdue) { <mat-icon>alarm</mat-icon> }
                    @else if (task.status === 'Concluido') { <mat-icon>check</mat-icon> }
                    <span>{{ task.title }}</span>
                  </button>
                }
                @if (hiddenCount(day) > 0) {
                  <button class="more" (click)="expand(day.iso)">{{ 'calendar.more' | transloco: { count: hiddenCount(day) } }}</button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .cal-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 16px 20px 8px; }
    .cal-toolbar mat-form-field { width: 190px; }
    .nav { display: flex; align-items: center; gap: 4px; }
    .nav h2 { font-size: 18px; margin-left: 10px; min-width: 180px; }
    .legend { display: flex; gap: 16px; flex-wrap: wrap; padding: 0 20px 12px; align-items: center; color: var(--k2-text-2); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .late-icon { font-size: 15px; width: 15px; height: 15px; color: var(--k2-danger); }
    .weekdays, .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .weekdays div { padding: 8px 10px; font-size: 12px; font-weight: 600; color: var(--k2-text-muted); text-transform: uppercase; border-top: 1px solid var(--k2-border); }
    .day { min-height: 118px; border-top: 1px solid var(--k2-border); border-right: 1px solid var(--k2-border); padding: 6px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .day:nth-child(7n) { border-right: 0; }
    .grid.week .day { min-height: 420px; }
    .day.out { background: var(--k2-surface-2); }
    .day.out .num { color: var(--k2-text-muted); }
    .day-head { display: flex; align-items: center; gap: 4px; }
    .num { font-weight: 600; font-size: 13px; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; }
    .today .num { background: var(--k2-gradient); color: #fff; }
    .add { opacity: 0; border: 0; background: transparent; cursor: pointer; color: var(--k2-text-muted); border-radius: 6px; display: grid; place-items: center; padding: 2px; }
    .add mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .day:hover .add, .add:focus-visible { opacity: 1; }
    .add:hover { background: var(--k2-surface-hover); color: var(--k2-primary); }
    .items { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .chip { display: flex; align-items: center; gap: 4px; width: 100%; text-align: left; border: 0; cursor: pointer; font: inherit; font-size: 12px; line-height: 1.3;
            padding: 3px 6px; border-radius: 6px; color: var(--k2-text); background: color-mix(in srgb, var(--c) 14%, transparent); border-left: 3px solid var(--c); }
    .chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip mat-icon { font-size: 13px; width: 13px; height: 13px; flex-shrink: 0; }
    .chip:hover { filter: brightness(0.96); }
    .chip.overdue { outline: 1px solid var(--k2-danger); }
    .chip.overdue mat-icon { color: var(--k2-danger); }
    .chip.done span { text-decoration: line-through; color: var(--k2-text-muted); }
    .more { border: 0; background: none; color: var(--k2-primary); font-size: 12px; cursor: pointer; text-align: left; padding: 2px 6px; font-weight: 600; }
    @media (max-width: 760px) {
      .grid:not(.week) .chip span { display: none; }
      .grid:not(.week) .chip { width: auto; }
      .grid:not(.week) .items { flex-direction: row; flex-wrap: wrap; }
      .day { min-height: 76px; }
      .grid.week, .weekdays.week { grid-template-columns: 1fr; }
      .weekdays.week { display: none; }
      .grid.week .day { min-height: auto; border-right: 0; }
      .cal-toolbar mat-form-field { width: 100%; }
    }
  `,
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
