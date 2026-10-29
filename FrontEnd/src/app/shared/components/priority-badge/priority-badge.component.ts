import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { TASK_PRIORITIES, optionOf } from '../../models/labels';
import { TaskPriority } from '../../models/models';

@Component({
  selector: 'k2-priority',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './priority-badge.component.html',
  styleUrl: './priority-badge.component.scss',
})
export class PriorityBadgeComponent {
  readonly priority = input.required<TaskPriority>();
  readonly opt = computed(() => optionOf(TASK_PRIORITIES, this.priority()));
}
