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
import { t } from '../../core/i18n/i18n-state';
import { TasksApi } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent, PriorityBadgeComponent, TaskStatusBadgeComponent } from '../../shared/components/badges.component';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/components/states.component';
import { TASK_STATUSES } from '../../shared/models/labels';
import { TaskDetail, TaskItem, TaskStatus } from '../../shared/models/models';
import { apiErrorMessage, formatDate, formatDateTime, relativeDue } from '../../shared/utils';
import { TaskCommentsComponent } from '../comments/task-comments.component';
import { TaskFormData, TaskFormDialogComponent } from './task-form-dialog.component';

@Component({
  selector: 'k2-task-detail-dialog',
  imports: [MatDialogModule, MatButtonModule, MatButtonToggleModule, MatIconModule, MatDividerModule, MatTooltipModule, TranslocoPipe,
    AvatarComponent, PriorityBadgeComponent, TaskStatusBadgeComponent, LoadingComponent, ErrorStateComponent, TaskCommentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading() && !detail()) {
      <k2-loading [message]="'tasks.detail.loading' | transloco" />
    } @else if (error()) {
      <k2-error [message]="errorText()" (retry)="load(currentId)" />
    } @else if (detail(); as d) {
      <div class="head">
        <div class="crumbs muted small">
          <a (click)="goToProject(d.task.projectId)">{{ d.task.projectName }}</a>
          @if (d.task.parentTaskId) {
            <mat-icon>chevron_right</mat-icon>
            <a (click)="load(d.task.parentTaskId!)">{{ d.task.parentTaskTitle }}</a>
          }
        </div>
        <h2 class="title">{{ d.task.title }}</h2>
        <div class="row">
          <k2-task-status [status]="d.task.status" />
          <k2-priority [priority]="d.task.priority" />
          @if (d.task.isOverdue) { <span class="badge overdue"><mat-icon>alarm</mat-icon> {{ 'tasks.detail.overdue' | transloco }}</span> }
        </div>
        <button mat-icon-button class="close" mat-dialog-close [attr.aria-label]="'common.close' | transloco"><mat-icon>close</mat-icon></button>
      </div>

      <mat-dialog-content class="content">
        <div class="grid">
          <div class="main">
            @if (d.task.canChangeStatus) {
              <div class="status-change">
                <span class="label">{{ 'tasks.detail.changeStatus' | transloco }}</span>
                <mat-button-toggle-group [value]="d.task.status" (change)="changeStatus($event.value)" [disabled]="busy()" hideSingleSelectionIndicator>
                  @for (s of statuses; track s.value) {
                    <mat-button-toggle [value]="s.value"><mat-icon [style.color]="s.color">{{ s.icon }}</mat-icon> {{ s.labelKey | transloco }}</mat-button-toggle>
                  }
                </mat-button-toggle-group>
              </div>
            }

            <h4>{{ 'tasks.detail.description' | transloco }}</h4>
            <p class="description">{{ d.description || ('tasks.detail.noDescription' | transloco) }}</p>

            <div class="subtasks">
              <div class="row">
                <h4>{{ 'tasks.detail.subtasks' | transloco }} <span class="muted">({{ d.task.completedSubtaskCount }}/{{ d.task.subtaskCount }})</span></h4>
                <span class="spacer"></span>
                @if (d.task.canEdit) {
                  <button mat-button (click)="newSubtask(d)"><mat-icon>add</mat-icon> {{ 'tasks.newSubtask' | transloco }}</button>
                }
              </div>
              @for (s of d.subtasks; track s.id) {
                <div class="subtask" (click)="load(s.id)">
                  <mat-icon [class.done]="s.status === 'Concluido'">{{ s.status === 'Concluido' ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  <span class="st-title" [class.done]="s.status === 'Concluido'">{{ s.title }}</span>
                  <k2-avatar [name]="s.assignedToName" [size]="24" [tooltip]="true" />
                  <k2-task-status [status]="s.status" />
                </div>
              } @empty {
                <p class="muted small">{{ 'tasks.detail.noSubtasks' | transloco }}</p>
              }
            </div>

            <mat-divider />
            <k2-task-comments [taskId]="d.task.id" />
          </div>

          <aside class="side">
            <div class="field"><span class="label">{{ 'tasks.detail.assignee' | transloco }}</span>
              <span class="value"><k2-avatar [name]="d.task.assignedToName" [size]="26" /> {{ d.task.assignedToName ?? ('common.noAssignee' | transloco) }}</span>
            </div>
            <div class="field"><span class="label">{{ 'tasks.detail.due' | transloco }}</span>
              <span class="value" [class.text-danger]="d.task.isOverdue"><mat-icon>event</mat-icon> {{ fmt(d.task.dueDate) }}</span>
              @if (d.task.dueDate && d.task.status !== 'Concluido') { <span class="muted small">{{ rel(d.task.dueDate) }}</span> }
            </div>
            <div class="field"><span class="label">{{ 'tasks.detail.start' | transloco }}</span><span class="value"><mat-icon>play_arrow</mat-icon> {{ fmt(d.task.startDate) }}</span></div>
            @if (d.task.completedAt) {
              <div class="field"><span class="label">{{ 'tasks.detail.completedAt' | transloco }}</span><span class="value"><mat-icon>task_alt</mat-icon> {{ fmtDateTime(d.task.completedAt) }}</span></div>
            }
            <div class="field"><span class="label">{{ 'tasks.detail.createdBy' | transloco }}</span><span class="value"><k2-avatar [name]="d.createdByName" [size]="26" /> {{ d.createdByName }}</span></div>
            <div class="field"><span class="label">{{ 'tasks.detail.createdAt' | transloco }}</span><span class="value">{{ fmtDateTime(d.task.createdAt) }}</span></div>
            @if (d.task.updatedAt) {
              <div class="field"><span class="label">{{ 'tasks.detail.updatedAt' | transloco }}</span><span class="value">{{ fmtDateTime(d.task.updatedAt) }}</span></div>
            }
          </aside>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-actions">
        @if (d.task.canEdit) {
          <button mat-button class="danger" (click)="remove(d)"><mat-icon>delete</mat-icon> {{ 'common.delete' | transloco }}</button>
        }
        <span class="spacer"></span>
        <button mat-button mat-dialog-close>{{ 'common.close' | transloco }}</button>
        @if (d.task.canEdit) {
          <button mat-flat-button class="btn-gradient" (click)="edit(d)"><mat-icon>edit</mat-icon> {{ 'common.edit' | transloco }}</button>
        }
      </mat-dialog-actions>
    }
  `,
  styles: `
    .head { padding: 20px 56px 8px 24px; position: relative; }
    .crumbs { display: flex; align-items: center; gap: 2px; margin-bottom: 6px; }
    .crumbs a { cursor: pointer; }
    .crumbs mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .title { font-size: 20px; font-weight: 700; margin-bottom: 10px; line-height: 1.3; }
    .close { position: absolute; top: 12px; right: 12px; }
    .badge.overdue { background: var(--k2-danger-soft); color: var(--k2-danger); }
    .badge.overdue mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .content { max-height: 72vh; }
    .grid { display: grid; grid-template-columns: 1fr 240px; gap: 24px; }
    .main { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
    h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--k2-text-muted); margin: 4px 0 0; }
    .description { white-space: pre-wrap; margin: 0; color: var(--k2-text-2); line-height: 1.5; }
    .status-change { display: flex; flex-direction: column; gap: 6px; }
    .status-change mat-icon { font-size: 18px; width: 18px; height: 18px; vertical-align: middle; }
    .label { font-size: 12px; color: var(--k2-text-muted); font-weight: 500; }
    .subtask { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--k2-border); border-radius: 10px; margin-top: 6px; cursor: pointer; }
    .subtask:hover { background: var(--k2-surface-hover); }
    .subtask mat-icon { color: var(--k2-text-muted); }
    .subtask mat-icon.done { color: var(--k2-status-done); }
    .st-title { flex: 1; min-width: 0; }
    .st-title.done { text-decoration: line-through; color: var(--k2-text-muted); }
    .side { background: var(--k2-surface-2); border: 1px solid var(--k2-border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 14px; align-self: start; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .value { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    .value mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--k2-text-muted); }
    .danger { color: var(--k2-danger) !important; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } .side { order: -1; } }
  `,
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
