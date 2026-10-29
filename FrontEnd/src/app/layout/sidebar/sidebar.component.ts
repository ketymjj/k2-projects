import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { UserRole } from '../../shared/models/models';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  roles?: UserRole[];
}

@Component({
  selector: 'k2-sidebar',
  imports: [RouterLink, RouterLinkActive, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  readonly center = inject(NotificationCenterService);
  readonly navigate = output<void>();

  private readonly all: NavItem[] = [
    { labelKey: 'nav.dashboard', icon: 'dashboard', route: '/dashboard' },
    { labelKey: 'nav.projects', icon: 'folder', route: '/projects' },
    { labelKey: 'nav.myTasks', icon: 'task_alt', route: '/my-tasks' },
    { labelKey: 'nav.kanban', icon: 'view_kanban', route: '/kanban' },
    { labelKey: 'nav.calendar', icon: 'calendar_month', route: '/calendar' },
    { labelKey: 'nav.users', icon: 'group', route: '/users', roles: ['Administrador'] },
    { labelKey: 'nav.notifications', icon: 'notifications', route: '/notifications' },
  ];

  readonly items = computed(() => {
    const role = this.auth.role();
    return this.all.filter((i) => !i.roles || (role && i.roles.includes(role)));
  });
}
