import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { NotificationCenterService } from '../core/services/notification-center.service';
import { RealtimeService } from '../core/services/realtime.service';
import { TaskDialogsService } from '../features/tasks/task-dialogs.service';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'k2-shell',
  imports: [MatSidenavModule, RouterOutlet, SidebarComponent, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-sidenav-container class="container">
      <mat-sidenav #nav class="nav" [mode]="isMobile() ? 'over' : 'side'" [opened]="!isMobile()">
        <k2-sidebar (navigate)="isMobile() && nav.close()" />
      </mat-sidenav>
      <mat-sidenav-content class="content">
        <k2-header (toggleMenu)="nav.toggle()" />
        <main><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .container { height: 100vh; background: var(--k2-bg); }
    .nav { width: 248px; border-right: 0; background: var(--k2-sidebar-bg); }
    .content { display: flex; flex-direction: column; }
    main { flex: 1; }
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly realtime = inject(RealtimeService);
  private readonly center = inject(NotificationCenterService);
  private readonly taskDialogs = inject(TaskDialogsService);

  readonly isMobile = toSignal(
    inject(BreakpointObserver).observe('(max-width: 960px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  ngOnInit(): void {
    this.center.openTaskHandler = (id) => this.taskDialogs.openDetail(id);
    this.center.start();
    this.realtime.connect();
  }

  ngOnDestroy(): void {
    this.center.stop();
    this.realtime.disconnect();
  }
}
