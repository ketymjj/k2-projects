import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { TaskDialogsService } from '../../features/tasks/task-dialogs.service';
import { AvatarComponent, RoleBadgeComponent } from '../../shared/components/badges.component';
import { LanguageSelectorComponent } from '../../shared/components/language-selector.component';
import { NOTIFICATION_ICONS } from '../../shared/models/labels';
import { AppNotification } from '../../shared/models/models';
import { capitalize, formatWith, notificationText, timeAgo } from '../../shared/utils';

@Component({
  selector: 'k2-header',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, MatTooltipModule,
    MatProgressBarModule, RouterLink, TranslocoPipe, AvatarComponent, RoleBadgeComponent, LanguageSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <button mat-icon-button class="menu-btn" (click)="toggleMenu.emit()" [attr.aria-label]="'header.openMenu' | transloco"><mat-icon>menu</mat-icon></button>
      <div class="greeting">
        <strong>{{ 'header.greeting' | transloco: { name: firstName() } }}</strong>
        <span class="muted small">{{ today() }}</span>
      </div>
      <span class="spacer"></span>

      <span class="live" [class.on]="realtime.connected()"
            [matTooltip]="(realtime.connected() ? 'header.realtimeOn' : 'header.realtimeOff') | transloco">
        <span class="dot"></span>
      </span>

      <span class="bell">
        <button mat-icon-button [matMenuTriggerFor]="notifMenu" (menuOpened)="center.loadLatest()"
                [attr.aria-label]="center.unreadCount() ? ('header.notificationsUnread' | transloco: { count: center.unreadCount() }) : ('header.notifications' | transloco)">
          <mat-icon>notifications</mat-icon>
        </button>
        @if (center.unreadCount() > 0) {
          <span class="bell-count" aria-hidden="true">{{ center.unreadCount() > 99 ? '99+' : center.unreadCount() }}</span>
        }
      </span>
      <mat-menu #notifMenu="matMenu" xPosition="before" class="notif-menu">
        <div class="menu-head" (click)="$event.stopPropagation()">
          <strong>{{ 'header.notifications' | transloco }}</strong>
          <button mat-button (click)="center.markAllRead()" [disabled]="center.unreadCount() === 0">{{ 'header.markAllRead' | transloco }}</button>
        </div>
        @if (center.loadingLatest()) { <mat-progress-bar mode="indeterminate" /> }
        @for (n of center.latest(); track n.id) {
          <button mat-menu-item class="notif" [class.unread]="!n.isRead" (click)="open(n)">
            <mat-icon [style.color]="icon(n).color">{{ icon(n).icon }}</mat-icon>
            <span class="notif-text">
              <strong>{{ text(n).title }}</strong>
              <span>{{ text(n).message }}</span>
              <span class="muted small">{{ ago(n.createdAt) }}</span>
            </span>
          </button>
        } @empty {
          @if (!center.loadingLatest()) { <div class="menu-empty muted">{{ 'header.noNotifications' | transloco }}</div> }
        }
        <mat-divider />
        <a mat-menu-item routerLink="/notifications"><mat-icon>list</mat-icon> {{ 'header.viewAll' | transloco }}</a>
      </mat-menu>

      <k2-language-selector [compact]="true" />

      <button class="user" [matMenuTriggerFor]="userMenu" [attr.aria-label]="'header.userMenu' | transloco">
        <k2-avatar [name]="auth.user()?.name ?? null" [size]="34" />
        <span class="user-info">
          <strong>{{ auth.user()?.name }}</strong>
          <span class="muted small">{{ auth.user()?.email }}</span>
        </span>
        <mat-icon>expand_more</mat-icon>
      </button>
      <mat-menu #userMenu="matMenu" xPosition="before">
        <div class="user-head">
          <strong>{{ auth.user()?.name }}</strong>
          @if (auth.user(); as u) { <k2-role [role]="u.role" /> }
        </div>
        <mat-divider />
        <a mat-menu-item routerLink="/settings"><mat-icon>settings</mat-icon> {{ 'header.settings' | transloco }}</a>
        <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon> {{ 'header.logout' | transloco }}</button>
      </mat-menu>
    </header>
  `,
  styles: `
    .header { height: 64px; display: flex; align-items: center; gap: 8px; padding: 0 20px; background: var(--k2-surface); border-bottom: 1px solid var(--k2-border); position: sticky; top: 0; z-index: 10; }
    .menu-btn { display: none; }
    .greeting { display: flex; flex-direction: column; line-height: 1.3; }
    .greeting strong { font-size: 15px; }
    .live { width: 22px; display: grid; place-items: center; }
    .live .dot { width: 8px; height: 8px; border-radius: 50%; background: #c3c7d6; }
    .live.on .dot { background: #1baf7a; box-shadow: 0 0 0 4px rgba(27,175,122,.18); }
    .bell { position: relative; display: inline-flex; }
    .bell-count { position: absolute; top: 2px; left: 24px; z-index: 1; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px;
                  background: #e5484d; color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center;
                  border: 2px solid var(--k2-surface); box-sizing: content-box; pointer-events: none; }
    k2-language-selector { margin: 0 4px; }
    .user { display: flex; align-items: center; gap: 10px; background: none; border: 0; cursor: pointer; padding: 6px 8px; border-radius: 12px; color: inherit; font: inherit; }
    .user:hover { background: var(--k2-surface-hover); }
    .user-info { display: flex; flex-direction: column; text-align: left; line-height: 1.25; }
    .user-head { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
    .menu-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 16px; gap: 12px; }
    .notif { height: auto !important; min-height: 64px; padding-top: 8px !important; padding-bottom: 8px !important; white-space: normal; }
    .notif.unread { background: var(--k2-primary-soft); }
    .notif-text { display: flex; flex-direction: column; gap: 2px; font-size: 13px; line-height: 1.35; }
    .menu-empty { padding: 20px 16px; text-align: center; }
    @media (max-width: 960px) { .menu-btn { display: inline-flex; } }
    @media (max-width: 640px) { .user-info, .greeting .small { display: none; } .header { padding: 0 8px; gap: 4px; } }
  `,
})
export class HeaderComponent {
  readonly auth = inject(AuthService);
  readonly center = inject(NotificationCenterService);
  readonly realtime = inject(RealtimeService);
  private readonly taskDialogs = inject(TaskDialogsService);
  private readonly router = inject(Router);
  readonly toggleMenu = output<void>();

  readonly ago = timeAgo;
  readonly text = notificationText;

  today(): string {
    return capitalize(formatWith(new Date(), { weekday: 'long', day: '2-digit', month: 'long' }));
  }

  firstName(): string {
    return this.auth.user()?.name.split(' ')[0] ?? '';
  }

  icon(n: AppNotification) {
    return NOTIFICATION_ICONS[n.type];
  }

  open(n: AppNotification): void {
    this.center.markRead(n);
    if (n.relatedTaskId) this.taskDialogs.openDetail(n.relatedTaskId);
    else this.router.navigate(['/notifications']);
  }

  logout(): void {
    this.auth.logout();
  }
}
