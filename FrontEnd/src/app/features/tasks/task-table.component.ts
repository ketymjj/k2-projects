import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent, PriorityBadgeComponent, TaskStatusBadgeComponent } from '../../shared/components/badges.component';
import { TaskItem } from '../../shared/models/models';
import { formatDate, relativeDue } from '../../shared/utils';
import { TaskDialogsService } from './task-dialogs.service';

/** Tabela de tarefas reutilizável; clique na linha abre os detalhes. */
@Component({
  selector: 'k2-task-table',
  imports: [MatTableModule, MatIconModule, MatTooltipModule, TranslocoPipe, AvatarComponent, PriorityBadgeComponent, TaskStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table mat-table [dataSource]="tasks()">
        <ng-container matColumnDef="title">
          <th mat-header-cell *matHeaderCellDef>{{ 'tasks.columns.task' | transloco }}</th>
          <td mat-cell *matCellDef="let t">
            <div class="title-cell">
              <span class="t" [class.done]="t.status === 'Concluido'">{{ t.title }}</span>
              <span class="muted small meta">
                @if (showProject()) { <span><mat-icon>folder</mat-icon>{{ t.projectName }}</span> }
                @if (t.parentTaskTitle) { <span><mat-icon>subdirectory_arrow_right</mat-icon>{{ t.parentTaskTitle }}</span> }
                @if (t.subtaskCount) { <span><mat-icon>account_tree</mat-icon>{{ t.completedSubtaskCount }}/{{ t.subtaskCount }}</span> }
                @if (t.commentCount) { <span><mat-icon>chat_bubble</mat-icon>{{ t.commentCount }}</span> }
              </span>
            </div>
          </td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>{{ 'tasks.columns.status' | transloco }}</th>
          <td mat-cell *matCellDef="let t"><k2-task-status [status]="t.status" /></td>
        </ng-container>
        <ng-container matColumnDef="priority">
          <th mat-header-cell *matHeaderCellDef>{{ 'tasks.columns.priority' | transloco }}</th>
          <td mat-cell *matCellDef="let t"><k2-priority [priority]="t.priority" /></td>
        </ng-container>
        <ng-container matColumnDef="assignee">
          <th mat-header-cell *matHeaderCellDef>{{ 'tasks.columns.assignee' | transloco }}</th>
          <td mat-cell *matCellDef="let t">
            <span class="assignee"><k2-avatar [name]="t.assignedToName" [size]="26" /> {{ t.assignedToName ?? '—' }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="due">
          <th mat-header-cell *matHeaderCellDef>{{ 'tasks.columns.due' | transloco }}</th>
          <td mat-cell *matCellDef="let t">
            <span class="due" [class.overdue]="t.isOverdue" [matTooltip]="t.status !== 'Concluido' ? rel(t.dueDate) : ''">
              @if (t.isOverdue) { <mat-icon>alarm</mat-icon> }
              {{ fmt(t.dueDate) }}
            </span>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns" class="clickable" (click)="open(row)"></tr>
      </table>
    </div>
  `,
  styles: `
    table { width: 100%; }
    .title-cell { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; }
    .t { font-weight: 500; }
    .t.done { text-decoration: line-through; color: var(--k2-text-muted); }
    .meta { display: flex; gap: 12px; flex-wrap: wrap; }
    .meta span { display: inline-flex; align-items: center; gap: 3px; }
    .meta mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .assignee { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
    .due { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
    .due.overdue { color: var(--k2-danger); font-weight: 600; }
    .due mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `,
})
export class TaskTableComponent {
  readonly tasks = input.required<TaskItem[]>();
  readonly showProject = input(true);
  private readonly dialogs = inject(TaskDialogsService);
  readonly columns = ['title', 'status', 'priority', 'assignee', 'due'];
  readonly fmt = formatDate;
  readonly rel = relativeDue;

  open(task: TaskItem): void {
    this.dialogs.openDetail(task.id);
  }
}
