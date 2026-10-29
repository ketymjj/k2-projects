import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { PriorityBadgeComponent } from '../../../shared/components/priority-badge/priority-badge.component';
import { TaskStatusBadgeComponent } from '../../../shared/components/task-status-badge/task-status-badge.component';
import { TaskItem } from '../../../shared/models/models';
import { formatDate, relativeDue } from '../../../shared/utils';
import { TaskDialogsService } from '../task-dialogs.service';

/** Tabela de tarefas reutilizável; clique na linha abre os detalhes. */
@Component({
  selector: 'k2-task-table',
  imports: [MatTableModule, MatIconModule, MatTooltipModule, TranslocoPipe, AvatarComponent, PriorityBadgeComponent, TaskStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-table.component.html',
  styleUrl: './task-table.component.scss',
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
