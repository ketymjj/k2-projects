import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TASK_STATUSES, optionOf } from '../../models/labels';
import { TaskStatus } from '../../models/models';

@Component({
  selector: 'k2-task-status',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-status-badge.component.html',
  styleUrl: './task-status-badge.component.scss',
})
export class TaskStatusBadgeComponent {
  readonly status = input.required<TaskStatus>();
  readonly opt = computed(() => optionOf(TASK_STATUSES, this.status()));
}
