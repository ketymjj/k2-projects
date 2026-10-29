import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { t } from '../../../core/i18n/i18n-state';
import { TasksApi } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { PriorityBadgeComponent } from '../../../shared/components/priority-badge/priority-badge.component';
import { TaskStatusBadgeComponent } from '../../../shared/components/task-status-badge/task-status-badge.component';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { TASK_STATUSES } from '../../../shared/models/labels';
import { TaskDetail, TaskItem, TaskStatus } from '../../../shared/models/models';
import { apiErrorMessage, formatDate, formatDateTime, relativeDue } from '../../../shared/utils';
import { TaskCommentsComponent } from '../../comments/task-comments.component';
import { TaskFormData, TaskFormDialogComponent } from '../task-form-dialog/task-form-dialog.component';

@Component({
  selector: 'k2-task-detail-dialog',
  imports: [MatDialogModule, MatButtonModule, MatButtonToggleModule, MatIconModule, MatDividerModule, MatTooltipModule, TranslocoPipe,
    AvatarComponent, PriorityBadgeComponent, TaskStatusBadgeComponent, LoadingComponent, ErrorStateComponent, TaskCommentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-detail-dialog.component.html',
  styleUrl: './task-detail-dialog.component.scss',
})
export class TaskDetailDialogComponent {
  private readonly api = inject(TasksApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly ref = inject(MatDialogRef<TaskDetailDialogComponent>);

  readonly statuses = TASK_STATUSES;
  readonly detail = signal<TaskDetail | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<unknown>(null);
  readonly fmt = formatDate;
  readonly fmtDateTime = formatDateTime;
  readonly rel = relativeDue;
  currentId: string;

  constructor() {
    this.currentId = inject<{ taskId: string }>(MAT_DIALOG_DATA).taskId;
    this.load(this.currentId);
  }

  errorText(): string {
    return apiErrorMessage(this.error(), 'errors.loadTask');
  }

  load(id: string): void {
    this.currentId = id;
    this.loading.set(true);
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (d) => { this.detail.set(d); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.error.set(e); },
    });
  }

  changeStatus(status: TaskStatus): void {
    const d = this.detail();
    if (!d || d.task.status === status) return;
    this.busy.set(true);
    this.api.changeStatus(d.task.id, status).subscribe({
      next: (task) => {
        this.detail.set({ ...d, task });
        this.busy.set(false);
        this.toast.success(t(status === 'Concluido' ? 'tasks.toast.completed' : 'tasks.toast.statusUpdated'));
      },
      error: (e) => {
        this.busy.set(false);
        this.detail.set({ ...d }); // restaura a seleção anterior
        this.toast.error(e);
      },
    });
  }

  async edit(d: TaskDetail): Promise<void> {
    const saved = await this.openForm({ task: d });
    if (saved) this.load(d.task.id);
  }

  async newSubtask(d: TaskDetail): Promise<void> {
    const saved = await this.openForm({ projectId: d.task.projectId, parentTaskId: d.task.id });
    if (saved) this.load(d.task.id);
  }

  async remove(d: TaskDetail): Promise<void> {
    const extra = d.task.subtaskCount > 0 ? `\n\n${t('tasks.delete.subtasksWarning', { count: d.task.subtaskCount })}` : '';
    const ok = await this.confirm.ask({
      title: t('tasks.delete.title'),
      message: t('tasks.delete.message', { title: d.task.title }) + extra,
      confirmText: t('common.delete'), danger: true,
    });
    if (!ok) return;
    this.api.delete(d.task.id, d.task.projectId).subscribe({
      next: () => { this.toast.success(t('tasks.toast.deleted')); this.ref.close(true); },
      error: (e) => this.toast.error(e),
    });
  }

  goToProject(projectId: string): void {
    this.ref.close();
    this.router.navigate(['/projects', projectId]);
  }

  private openForm(data: TaskFormData): Promise<TaskItem | undefined> {
    const ref = this.dialog.open(TaskFormDialogComponent, { data, width: '680px', maxWidth: '95vw', autoFocus: false });
    return firstValueFrom(ref.afterClosed());
  }
}
