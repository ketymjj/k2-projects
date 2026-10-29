import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PROJECT_STATUSES, optionOf } from '../../models/labels';
import { ProjectStatus } from '../../models/models';

@Component({
  selector: 'k2-project-status',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-status-badge.component.html',
  styleUrl: './project-status-badge.component.scss',
})
export class ProjectStatusBadgeComponent {
  readonly status = input.required<ProjectStatus>();
  readonly opt = computed(() => optionOf(PROJECT_STATUSES, this.status()));
}
