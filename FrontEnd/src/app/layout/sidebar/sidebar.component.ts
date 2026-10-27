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
  template: `
    <nav class="sidebar">
      <a class="brand" routerLink="/dashboard" (click)="navigate.emit()">
        <span class="logo">K2</span>
        <span class="name">{{ 'app.name' | transloco }}</span>
      </a>

      <div class="section">{{ 'nav.menu' | transloco }}</div>
      @for (item of items(); track item.route) {
        <a class="item" [routerLink]="item.route" routerLinkActive="active" (click)="navigate.emit()">
          <mat-icon>{{ item.icon }}</mat-icon>
          <span>{{ item.labelKey | transloco }}</span>
          @if (item.route === '/notifications' && center.unreadCount() > 0) {
            <span class="count">{{ center.unreadCount() > 99 ? '99+' : center.unreadCount() }}</span>
          }
        </a>
      }

      <div class="grow"></div>
      <a class="item" routerLink="/settings" routerLinkActive="active" (click)="navigate.emit()">
        <mat-icon>settings</mat-icon><span>{{ 'nav.settings' | transloco }}</span>
      </a>
    </nav>
  `,
  styles: `
    .sidebar { height: 100%; display: flex; flex-direction: column; padding: 18px 14px; background: var(--k2-sidebar-bg); color: var(--k2-sidebar-text); }
    .brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 22px; color: #fff; }
    .logo { width: 36px; height: 36px; border-radius: 11px; background: var(--k2-gradient); display: grid; place-items: center; font-weight: 800; font-size: 14px; box-shadow: 0 6px 18px rgba(124,77,255,.4); }
    .name { font-weight: 700; letter-spacing: 0.08em; font-size: 15px; }
    .section { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #6a71a0; padding: 0 12px 8px; }
    .item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; color: var(--k2-sidebar-text); font-weight: 500; margin-bottom: 2px; transition: background .15s, color .15s; position: relative; }
    .item:hover { background: var(--k2-sidebar-active); color: #fff; }
    .item.active { background: linear-gradient(135deg, rgba(54,87,245,.95), rgba(124,77,255,.95)); color: #fff; box-shadow: 0 6px 16px rgba(54,87,245,.35); }
    .item mat-icon { font-size: 21px; width: 21px; height: 21px; }
    .count { margin-left: auto; background: #ff5470; color: #fff; font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 99px; }
    .grow { flex: 1; }
  `,
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
