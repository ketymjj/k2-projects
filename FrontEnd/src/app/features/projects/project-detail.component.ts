import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, merge } from 'rxjs';
import { t } from '../../core/i18n/i18n-state';
import { ProjectsApi, TasksApi, UsersApi } from '../../core/services/api.services';
import { DataEventsService } from '../../core/services/data-events.service';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent, ProjectStatusBadgeComponent, RoleBadgeComponent } from '../../shared/components/badges.component';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/components/states.component';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../shared/models/labels';
import { PagedResult, ProjectDetail, ProjectMember, TaskItem, TaskPriority, TaskStatus, UserLookup } from '../../shared/models/models';
import { apiErrorMessage, formatDate } from '../../shared/utils';
import { TaskDialogsService } from '../tasks/task-dialogs.service';
import { TaskTableComponent } from '../tasks/task-table.component';
import { ProjectActionsService } from './project-actions.service';

@Component({
  selector: 'k2-project-detail',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatTabsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatPaginatorModule, MatProgressBarModule, MatTooltipModule, TranslocoPipe, LoadingComponent, ErrorStateComponent,
    EmptyStateComponent, ProjectStatusBadgeComponent, AvatarComponent, RoleBadgeComponent, TaskTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/projects" class="back"><mat-icon>arrow_back</mat-icon> {{ 'projects.back' | transloco }}</a>

      @if (loading() && !detail()) {
        <k2-loading />
      } @else if (error()) {
        <k2-error [message]="errorText()" (retry)="loadDetail()" />
      } @else if (detail(); as d) {
        <div class="card card-pad hero">
          <div class="hero-main">
            <div class="row">
              <h1>{{ d.project.name }}</h1>
              <k2-project-status [status]="d.project.status" />
            </div>
            <p class="muted desc">{{ d.project.description || ('projects.noDescription' | transloco) }}</p>
            <div class="facts">
              <span><mat-icon>person</mat-icon> {{ d.project.ownerName }}</span>
              <span><mat-icon>event</mat-icon>
                @if (d.project.startDate || d.project.dueDate) { {{ fmt(d.project.startDate) }} → {{ fmt(d.project.dueDate) }} }
                @else { {{ 'projects.noDates' | transloco }} }
              </span>
              <span><mat-icon>group</mat-icon> {{ 'projects.participants' | transloco: { count: d.members.length + 1 } }}</span>
            </div>
          </div>
          <div class="hero-side">
            <div class="ring" [style.--p]="d.project.progress">
              <span>{{ d.project.progress }}%</span>
            </div>
            <span class="muted small">{{ 'projects.completedOf' | transloco: { done: d.project.completedTaskCount, total: d.project.taskCount } }}</span>
          </div>
          <div class="hero-actions">
            <button mat-stroked-button (click)="openKanban()"><mat-icon>view_kanban</mat-icon> {{ 'nav.kanban' | transloco }}</button>
            @if (d.project.canManage) {
              <button mat-stroked-button (click)="edit()"><mat-icon>edit</mat-icon> {{ 'common.edit' | transloco }}</button>
              <button mat-stroked-button class="danger" (click)="remove()"><mat-icon>delete</mat-icon> {{ 'common.delete' | transloco }}</button>
            }
          </div>
        </div>

        <div class="stats">
          <div class="card stat"><span class="dot" style="background: var(--k2-status-todo)"></span><strong>{{ d.todoCount }}</strong><span class="muted">{{ 'projects.stats.todo' | transloco }}</span></div>
          <div class="card stat"><span class="dot" style="background: var(--k2-status-doing)"></span><strong>{{ d.inProgressCount }}</strong><span class="muted">{{ 'projects.stats.inProgress' | transloco }}</span></div>
          <div class="card stat"><span class="dot" style="background: var(--k2-status-done)"></span><strong>{{ d.project.completedTaskCount }}</strong><span class="muted">{{ 'projects.stats.completed' | transloco }}</span></div>
          <div class="card stat"><span class="dot" style="background: var(--k2-danger)"></span><strong>{{ d.project.overdueTaskCount }}</strong><span class="muted">{{ 'projects.stats.overdue' | transloco }}</span></div>
        </div>

        <div class="card">
          <mat-tab-group mat-stretch-tabs="false" animationDuration="150ms">
            <mat-tab [label]="'projects.tabs.tasks' | transloco">
              <div class="toolbar card-pad tab-toolbar">
                <mat-form-field class="search">
                  <mat-icon matPrefix>search</mat-icon>
                  <input matInput [placeholder]="'projects.searchTasks' | transloco" [formControl]="search" />
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'common.status' | transloco }}</mat-label>
                  <mat-select [formControl]="status">
                    <mat-option [value]="null">{{ 'common.all' | transloco }}</mat-option>
                    @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.labelKey | transloco }}</mat-option> }
                  </mat-select>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'common.priority' | transloco }}</mat-label>
                  <mat-select [formControl]="priority">
                    <mat-option [value]="null">{{ 'common.allFem' | transloco }}</mat-option>
                    @for (p of priorities; track p.value) { <mat-option [value]="p.value">{{ p.labelKey | transloco }}</mat-option> }
                  </mat-select>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'common.assignee' | transloco }}</mat-label>
                  <mat-select [formControl]="assignee">
                    <mat-option [value]="null">{{ 'common.all' | transloco }}</mat-option>
                    @for (m of participants(); track m.id) { <mat-option [value]="m.id">{{ m.name }}</mat-option> }
                  </mat-select>
                </mat-form-field>
                <span class="spacer"></span>
                @if (d.project.canManage) {
                  <button mat-flat-button class="btn-gradient" (click)="newTask()"><mat-icon>add</mat-icon> {{ 'tasks.new' | transloco }}</button>
                }
              </div>
              @if (tasksLoading()) { <mat-progress-bar mode="indeterminate" /> }
              @if (tasks(); as page) {
                @if (page.items.length) {
                  <k2-task-table [tasks]="page.items" [showProject]="false" />
                  <mat-paginator [length]="page.totalCount" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
                                 [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
                } @else {
                  <k2-empty icon="task" [title]="'projects.tasksEmptyTitle' | transloco"
                            [message]="(hasFilters() ? 'projects.tasksEmptyFiltered' : 'projects.tasksEmptyNone') | transloco" />
                }
              }
            </mat-tab>

            <mat-tab [label]="'projects.tabs.members' | transloco: { count: d.members.length + 1 }">
              <div class="card-pad">
                @if (d.project.canManage) {
                  <div class="row add-member">
                    <mat-form-field class="member-select">
                      <mat-label>{{ 'projects.members.add' | transloco }}</mat-label>
                      <mat-select [(ngModel)]="newMemberId">
                        @for (u of availableUsers(); track u.id) { <mat-option [value]="u.id">{{ u.name }} · {{ u.email }}</mat-option> }
                      </mat-select>
                    </mat-form-field>
                    <button mat-flat-button (click)="addMember()" [disabled]="!newMemberId || busy()"><mat-icon>person_add</mat-icon> {{ 'projects.members.addButton' | transloco }}</button>
                  </div>
                }
                <div class="member owner">
                  <k2-avatar [name]="d.project.ownerName" [size]="38" />
                  <div class="grow"><strong>{{ d.project.ownerName }}</strong><span class="muted small">{{ 'projects.members.ownerLabel' | transloco }}</span></div>
                  <span class="badge">{{ 'projects.members.ownerBadge' | transloco }}</span>
                </div>
                @for (m of d.members; track m.userId) {
                  <div class="member">
                    <k2-avatar [name]="m.name" [size]="38" />
                    <div class="grow"><strong>{{ m.name }}</strong><span class="muted small">{{ m.email }} · {{ 'projects.members.openTasks' | transloco: { count: m.openTaskCount } }}</span></div>
                    <k2-role [role]="m.role" />
                    @if (d.project.canManage) {
                      <button mat-icon-button (click)="removeMember(m)" [matTooltip]="'projects.members.removeTooltip' | transloco" [attr.aria-label]="'projects.members.removeTooltip' | transloco"><mat-icon>person_remove</mat-icon></button>
                    }
                  </div>
                } @empty {
                  <k2-empty icon="group_add" [title]="'projects.members.emptyTitle' | transloco" [message]="'projects.members.emptyMessage' | transloco" />
                }
              </div>
            </mat-tab>
          </mat-tab-group>
        </div>
      }
    </div>
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 14px; font-weight: 500; }
    .hero { display: grid; grid-template-columns: 1fr auto; gap: 16px 28px; margin-bottom: 16px; }
    .hero h1 { font-size: 24px; }
    .desc { margin: 8px 0 12px; max-width: 760px; line-height: 1.5; }
    .facts { display: flex; gap: 20px; flex-wrap: wrap; color: var(--k2-text-2); }
    .facts span { display: inline-flex; align-items: center; gap: 6px; }
    .facts mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--k2-text-muted); }
    .hero-side { display: flex; flex-direction: column; align-items: center; gap: 8px; grid-row: span 2; justify-content: center; }
    .ring { --p: 0; width: 104px; height: 104px; border-radius: 50%; display: grid; place-items: center;
            background: conic-gradient(var(--k2-primary) calc(var(--p) * 1%), var(--k2-surface-2) 0); position: relative; }
    .ring::before { content: ''; position: absolute; inset: 10px; border-radius: 50%; background: var(--k2-surface); }
    .ring span { position: relative; font-size: 22px; font-weight: 700; }
    .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .danger { color: var(--k2-danger) !important; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
    .stat { padding: 14px 16px; display: flex; align-items: center; gap: 10px; }
    .stat strong { font-size: 20px; }
    .stat .dot { width: 10px; height: 10px; border-radius: 50%; }
    .tab-toolbar { padding-bottom: 0; }
    .add-member { margin-bottom: 8px; }
    .member-select { min-width: 300px; flex: 1; max-width: 460px; }
    .add-member .mat-mdc-form-field-subscript-wrapper { display: none; }
    .member { display: flex; align-items: center; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--k2-border); }
    .member .grow { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    @media (max-width: 800px) { .hero { grid-template-columns: 1fr; } .hero-side { grid-row: auto; } .stats { grid-template-columns: repeat(2, 1fr); } }
  `,
})
export class ProjectDetailComponent {
  readonly id = input.required<string>();
  private readonly projectsApi = inject(ProjectsApi);
  private readonly tasksApi = inject(TasksApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly actions = inject(ProjectActionsService);
  private readonly taskDialogs = inject(TaskDialogsService);
  private readonly router = inject(Router);

  readonly statuses = TASK_STATUSES;
  readonly priorities = TASK_PRIORITIES;
  readonly detail = signal<ProjectDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly busy = signal(false);
  readonly tasks = signal<PagedResult<TaskItem> | null>(null);
  readonly tasksLoading = signal(false);
  readonly users = signal<UserLookup[]>([]);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly fmt = formatDate;
  newMemberId: string | null = null;

  readonly search = new FormControl('', { nonNullable: true });
  readonly status = new FormControl<TaskStatus | null>(null);
  readonly priority = new FormControl<TaskPriority | null>(null);
  readonly assignee = new FormControl<string | null>(null);

  readonly participants = computed(() => {
    const d = this.detail();
    if (!d) return [];
    return [{ id: d.project.ownerId, name: d.project.ownerName }, ...d.members.map((m) => ({ id: m.userId, name: m.name }))];
  });

  readonly availableUsers = computed(() => {
    const d = this.detail();
    if (!d) return [];
    const taken = new Set([d.project.ownerId, ...d.members.map((m) => m.userId)]);
    return this.users().filter((u) => !taken.has(u.id));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      this.id();
      untracked(() => { this.loadDetail(); this.loadTasks(); });
    });
    merge(this.search.valueChanges.pipe(debounceTime(350)), this.status.valueChanges, this.priority.valueChanges, this.assignee.valueChanges)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => { this.pageIndex.set(0); this.loadTasks(); });
    inject(DataEventsService).changes().pipe(takeUntilDestroyed(destroyRef)).subscribe((c) => {
      if (!c.projectId || c.projectId === this.id()) { this.loadDetail(true); this.loadTasks(); }
    });
    inject(UsersApi).lookup().subscribe({ next: (u) => this.users.set(u), error: () => undefined });
  }

  errorText(): string {
    return apiErrorMessage(this.error(), 'errors.loadProject');
  }

  hasFilters(): boolean {
    return !!(this.search.value || this.status.value || this.priority.value || this.assignee.value);
  }

  loadDetail(silent = false): void {
    if (!silent) this.loading.set(true);
    this.error.set(null);
    this.projectsApi.get(this.id()).subscribe({
      next: (d) => { this.detail.set(d); this.loading.set(false); },
      error: (e) => {
        this.loading.set(false);
        if (e?.status === 404 && silent) { this.router.navigate(['/projects']); return; }
        this.error.set(e);
      },
    });
  }

  loadTasks(): void {
    this.tasksLoading.set(true);
    this.tasksApi.list({
      projectId: this.id(), search: this.search.value, status: this.status.value ?? undefined,
      priority: this.priority.value ?? undefined, assignedToId: this.assignee.value ?? undefined,
      page: this.pageIndex() + 1, pageSize: this.pageSize(),
    }).subscribe({
      next: (p) => { this.tasks.set(p); this.tasksLoading.set(false); },
      error: (e) => { this.tasksLoading.set(false); this.toast.error(e, 'errors.loadTasks'); },
    });
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.loadTasks();
  }

  async newTask(): Promise<void> {
    await this.taskDialogs.openForm({ projectId: this.id() });
  }

  openKanban(): void {
    this.router.navigate(['/kanban'], { queryParams: { project: this.id() } });
  }

  async edit(): Promise<void> {
    const d = this.detail();
    if (d && (await this.actions.openForm(d.project))) this.loadDetail(true);
  }

  async remove(): Promise<void> {
    const d = this.detail();
    if (d && (await this.actions.delete(d.project))) this.router.navigate(['/projects']);
  }

  addMember(): void {
    if (!this.newMemberId) return;
    this.busy.set(true);
    this.projectsApi.addMember(this.id(), this.newMemberId).subscribe({
      next: (members) => {
        this.detail.update((d) => (d ? { ...d, members } : d));
        this.newMemberId = null;
        this.busy.set(false);
        this.toast.success(t('projects.members.added'));
      },
      error: (e) => { this.busy.set(false); this.toast.error(e); },
    });
  }

  async removeMember(m: ProjectMember): Promise<void> {
    const ok = await this.confirm.ask({
      title: t('projects.members.removeTitle'), message: t('projects.members.removeMessage', { name: m.name }), confirmText: t('common.remove'), danger: true,
    });
    if (!ok) return;
    this.projectsApi.removeMember(this.id(), m.userId).subscribe({
      next: () => {
        this.detail.update((d) => (d ? { ...d, members: d.members.filter((x) => x.userId !== m.userId) } : d));
        this.toast.success(t('projects.members.removed'));
      },
      error: (e) => this.toast.error(e),
    });
  }
}
