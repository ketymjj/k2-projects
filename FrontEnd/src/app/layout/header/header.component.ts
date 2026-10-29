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
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { RoleBadgeComponent } from '../../shared/components/role-badge/role-badge.component';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector.component';
import { NOTIFICATION_ICONS } from '../../shared/models/labels';
import { AppNotification } from '../../shared/models/models';
import { capitalize, formatWith, notificationText, timeAgo } from '../../shared/utils';

@Component({
  selector: 'k2-header',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, MatTooltipModule,
    MatProgressBarModule, RouterLink, TranslocoPipe, AvatarComponent, RoleBadgeComponent, LanguageSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
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
