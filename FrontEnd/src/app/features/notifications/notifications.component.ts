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
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { NOTIFICATION_ICONS } from '../../shared/models/labels';
import { AppNotification, PagedResult } from '../../shared/models/models';
import { apiErrorMessage, notificationText, timeAgo } from '../../shared/utils';
import { TaskDialogsService } from '../tasks/task-dialogs.service';

@Component({
  selector: 'k2-notifications',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, MatPaginatorModule, MatTooltipModule, TranslocoPipe, PageHeaderComponent,
    LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
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
