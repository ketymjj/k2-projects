import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES, USER_ROLES, optionOf } from '../models/labels';
import { ProjectStatus, TaskPriority, TaskStatus, UserRole } from '../models/models';
import { initials } from '../utils';

const badgeStyles = `
  :host { display: inline-flex; }
  .badge { border: 1px solid color-mix(in srgb, var(--c) 30%, transparent); background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--k2-text); }
  .badge .dot { background: var(--c); }
  .badge mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--c); }
`;

@Component({
  selector: 'k2-task-status',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [style.--c]="opt()?.color"><span class="dot"></span>{{ opt()?.labelKey ?? '' | transloco }}</span>`,
  styles: badgeStyles,
})
export class TaskStatusBadgeComponent {
  readonly status = input.required<TaskStatus>();
  readonly opt = computed(() => optionOf(TASK_STATUSES, this.status()));
}

@Component({
  selector: 'k2-priority',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [style.--c]="opt()?.color"><mat-icon>{{ opt()?.icon }}</mat-icon>{{ opt()?.labelKey ?? '' | transloco }}</span>`,
  styles: badgeStyles,
})
export class PriorityBadgeComponent {
  readonly priority = input.required<TaskPriority>();
  readonly opt = computed(() => optionOf(TASK_PRIORITIES, this.priority()));
}

@Component({
  selector: 'k2-project-status',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [style.--c]="opt()?.color"><span class="dot"></span>{{ opt()?.labelKey ?? '' | transloco }}</span>`,
  styles: badgeStyles,
})
export class ProjectStatusBadgeComponent {
  readonly status = input.required<ProjectStatus>();
  readonly opt = computed(() => optionOf(PROJECT_STATUSES, this.status()));
}

@Component({
  selector: 'k2-role',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [style.--c]="opt()?.color"><mat-icon>{{ opt()?.icon }}</mat-icon>{{ opt()?.labelKey ?? '' | transloco }}</span>`,
  styles: badgeStyles,
})
export class RoleBadgeComponent {
  readonly role = input.required<UserRole>();
  readonly opt = computed(() => optionOf(USER_ROLES, this.role()));
}

const AVATAR_COLORS = ['#3657f5', '#7c4dff', '#0e8f6a', '#c2410c', '#be185d', '#0369a1', '#6d28d9', '#047857'];

@Component({
  selector: 'k2-avatar',
  imports: [MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="avatar" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.4"
          [style.background]="color()" [matTooltip]="tooltip() ? (name() ?? ('common.noAssignee' | transloco)) : ''">
      {{ text() }}
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .avatar { border-radius: 50%; display: inline-grid; place-items: center; color: #fff; font-weight: 600; flex-shrink: 0; letter-spacing: 0.02em; }
  `,
})
export class AvatarComponent {
  readonly name = input<string | null>(null);
  readonly size = input(32);
  readonly tooltip = input(false);
  readonly text = computed(() => (this.name() ? initials(this.name()) : '—'));
  readonly color = computed(() => {
    const n = this.name();
    if (!n) return '#9aa1b9';
    let hash = 0;
    for (const ch of n) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  });
}
