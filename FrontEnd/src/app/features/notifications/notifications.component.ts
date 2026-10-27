import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { t } from '../../core/i18n/i18n-state';
import { NotificationsApi } from '../../core/services/api.services';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/components/states.component';
import { NOTIFICATION_ICONS } from '../../shared/models/labels';
import { AppNotification, PagedResult } from '../../shared/models/models';
import { apiErrorMessage, notificationText, timeAgo } from '../../shared/utils';
import { TaskDialogsService } from '../tasks/task-dialogs.service';

@Component({
  selector: 'k2-notifications',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, MatPaginatorModule, MatTooltipModule, TranslocoPipe, PageHeaderComponent,
    LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <k2-page-header [title]="'notifications.title' | transloco" [subtitle]="'notifications.subtitle' | transloco">
        <button mat-stroked-button (click)="markAll()" [disabled]="center.unreadCount() === 0"><mat-icon>done_all</mat-icon> {{ 'notifications.markAllRead' | transloco }}</button>
      </k2-page-header>

      <div class="card">
        <div class="card-pad head">
          <mat-button-toggle-group [value]="onlyUnread()" (change)="setFilter($event.value)" hideSingleSelectionIndicator>
            <mat-button-toggle [value]="false">{{ 'notifications.all' | transloco }}</mat-button-toggle>
            <mat-button-toggle [value]="true">{{ 'notifications.unread' | transloco: { count: center.unreadCount() } }}</mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        @if (loading() && !page()) {
          <k2-loading />
        } @else if (error()) {
          <k2-error [message]="errorText()" (retry)="load()" />
        } @else if (page()?.items?.length === 0) {
          <k2-empty icon="notifications_off" [title]="(onlyUnread() ? 'notifications.emptyUnread' : 'notifications.emptyAll') | transloco"
                    [message]="'notifications.emptyMessage' | transloco" />
        } @else {
          @for (n of page()?.items ?? []; track n.id) {
            <div class="notif" [class.unread]="!n.isRead">
              <span class="icon" [style.color]="icon(n).color" [style.background]="icon(n).color + '1a'"><mat-icon>{{ icon(n).icon }}</mat-icon></span>
              <div class="text">
                <strong>{{ text(n).title }}</strong>
                <span>{{ text(n).message }}</span>
                <span class="muted small">{{ ago(n.createdAt) }}</span>
              </div>
              <div class="actions">
                @if (n.relatedTaskId) {
                  <button mat-stroked-button (click)="openTask(n)"><mat-icon>open_in_new</mat-icon> {{ 'notifications.openTask' | transloco }}</button>
                }
                @if (!n.isRead) {
                  <button mat-icon-button (click)="markRead(n)" [matTooltip]="'notifications.markRead' | transloco" [attr.aria-label]="'notifications.markRead' | transloco"><mat-icon>done</mat-icon></button>
                }
              </div>
            </div>
          }
          <mat-paginator [length]="page()?.totalCount ?? 0" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
        }
      </div>
    </div>
  `,
  styles: `
    .head { padding-bottom: 8px; }
    .notif { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-top: 1px solid var(--k2-border); }
    .notif.unread { background: color-mix(in srgb, var(--k2-primary) 5%, transparent); box-shadow: inset 3px 0 0 var(--k2-primary); }
    .icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; }
    .text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .actions { display: flex; align-items: center; gap: 4px; }
    @media (max-width: 640px) { .notif { flex-wrap: wrap; } .actions { width: 100%; justify-content: flex-end; } }
  `,
})
export class NotificationsComponent {
  readonly center = inject(NotificationCenterService);
  private readonly api = inject(NotificationsApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(TaskDialogsService);

  readonly page = signal<PagedResult<AppNotification> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly onlyUnread = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);
  readonly ago = timeAgo;
  readonly text = notificationText;

  constructor() {
    this.load();
    // novas notificações em tempo real entram no topo da lista
    inject(RealtimeService).notification$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.load());
  }

  icon(n: AppNotification) { return NOTIFICATION_ICONS[n.type]; }

  errorText(): string {
    return apiErrorMessage(this.error(), 'errors.loadNotifications');
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({ onlyUnread: this.onlyUnread() || undefined, page: this.pageIndex() + 1, pageSize: this.pageSize() }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.error.set(e); },
    });
  }

  setFilter(onlyUnread: boolean): void {
    this.onlyUnread.set(onlyUnread);
    this.pageIndex.set(0);
    this.load();
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.load();
  }

  markRead(n: AppNotification): void {
    this.api.markRead(n.id).subscribe({
      next: () => { this.center.refreshCount(); this.load(); },
      error: (e) => this.toast.error(e),
    });
  }

  markAll(): void {
    this.api.markAllRead().subscribe({
      next: () => { this.center.unreadCount.set(0); this.toast.success(t('notifications.allMarked')); this.load(); },
      error: (e) => this.toast.error(e),
    });
  }

  openTask(n: AppNotification): void {
    if (!n.isRead) this.markRead(n);
    this.dialogs.openDetail(n.relatedTaskId!);
  }
}
