import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppNotification } from '../../shared/models/models';
import { notificationText } from '../../shared/utils';
import { t } from '../i18n/i18n-state';
import { NotificationsApi } from './api.services';
import { PreferencesService } from './preferences.service';
import { RealtimeService } from './realtime.service';
import { ToastService } from './toast.service';

/** Estado das notificações no cabeçalho (contador de não lidas e últimas recebidas). */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly api = inject(NotificationsApi);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly prefs = inject(PreferencesService);
  private subscription?: Subscription;

  readonly unreadCount = signal(0);
  readonly latest = signal<AppNotification[]>([]);
  readonly loadingLatest = signal(false);

  /** Callback para abrir a tarefa ao clicar em "Ver" no aviso em tempo real. */
  openTaskHandler?: (taskId: string) => void;

  start(): void {
    this.refreshCount();
    this.subscription?.unsubscribe();
    this.subscription = this.realtime.notification$.subscribe((n) => {
      this.unreadCount.update((c) => c + 1);
      this.latest.update((list) => [n, ...list].slice(0, 8));
      if (this.prefs.preferences().realtimeToasts) {
        const text = notificationText(n);
        const ref = this.toast.info(t('notifications.toast', text), n.relatedTaskId ? t('notifications.view') : 'OK');
        if (n.relatedTaskId) {
          ref.onAction().subscribe(() => {
            this.markRead(n);
            this.openTaskHandler?.(n.relatedTaskId!);
          });
        }
      }
    });
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.unreadCount.set(0);
    this.latest.set([]);
  }

  refreshCount(): void {
    this.api.unreadCount().subscribe({ next: (r) => this.unreadCount.set(r.count), error: () => undefined });
  }

  loadLatest(): void {
    this.loadingLatest.set(true);
    this.api.list({ pageSize: 8 }).subscribe({
      next: (page) => { this.latest.set(page.items); this.loadingLatest.set(false); },
      error: () => this.loadingLatest.set(false),
    });
  }

  markRead(n: AppNotification): void {
    if (n.isRead) return;
    this.api.markRead(n.id).subscribe({
      next: () => {
        this.latest.update((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        this.refreshCount();
      },
      error: () => undefined,
    });
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe({
      next: () => {
        this.latest.update((list) => list.map((x) => ({ ...x, isRead: true })));
        this.unreadCount.set(0);
        this.toast.success(t('notifications.allMarked'));
      },
      error: (e) => this.toast.error(e),
    });
  }
}
