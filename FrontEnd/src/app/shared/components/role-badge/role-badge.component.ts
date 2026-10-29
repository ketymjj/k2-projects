import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { USER_ROLES, optionOf } from '../../models/labels';
import { UserRole } from '../../models/models';

@Component({
  selector: 'k2-role',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-badge.component.html',
  styleUrl: './role-badge.component.scss',
})
export class RoleBadgeComponent {
  readonly role = input.required<UserRole>();
  readonly opt = computed(() => optionOf(USER_ROLES, this.role()));
}
