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
import { t } from '../../../core/i18n/i18n-state';
import { ProjectsApi, TasksApi, UsersApi } from '../../../core/services/api.services';
import { DataEventsService } from '../../../core/services/data-events.service';
import { ToastService } from '../../../core/services/toast.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ProjectStatusBadgeComponent } from '../../../shared/components/project-status-badge/project-status-badge.component';
import { RoleBadgeComponent } from '../../../shared/components/role-badge/role-badge.component';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../../shared/models/labels';
import { PagedResult, ProjectDetail, ProjectMember, TaskItem, TaskPriority, TaskStatus, UserLookup } from '../../../shared/models/models';
import { apiErrorMessage, formatDate } from '../../../shared/utils';
import { TaskDialogsService } from '../../tasks/task-dialogs.service';
import { TaskTableComponent } from '../../tasks/task-table/task-table.component';
import { ProjectActionsService } from '../project-actions.service';

@Component({
  selector: 'k2-project-detail',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatTabsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatPaginatorModule, MatProgressBarModule, MatTooltipModule, TranslocoPipe, LoadingComponent, ErrorStateComponent,
    EmptyStateComponent, ProjectStatusBadgeComponent, AvatarComponent, RoleBadgeComponent, TaskTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss',
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
