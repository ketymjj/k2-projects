import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { TasksApi } from '../../../core/services/api.services';
import { DataEventsService } from '../../../core/services/data-events.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { MyTasks } from '../../../shared/models/models';
import { apiErrorMessage } from '../../../shared/utils';
import { TaskTableComponent } from '../task-table/task-table.component';

/** Tarefas atribuídas ao usuário autenticado, agrupadas por situação. */
@Component({
  selector: 'k2-my-tasks',
  imports: [MatTabsModule, MatIconModule, TranslocoPipe, PageHeaderComponent, LoadingComponent, ErrorStateComponent, EmptyStateComponent, TaskTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-tasks.component.html',
  styleUrl: './my-tasks.component.scss',
})
export class MyTasksComponent {
  private readonly api = inject(TasksApi);
  readonly data = signal<MyTasks | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly selected = signal(0);

  readonly groups = computed(() => {
    const d = this.data();
    return [
      { key: 'todo', labelKey: 'myTasks.groups.todo', icon: 'radio_button_unchecked', color: 'var(--k2-status-todo)', items: d?.todo ?? [], emptyKey: 'myTasks.empty.todo' },
      { key: 'doing', labelKey: 'myTasks.groups.inProgress', icon: 'timelapse', color: 'var(--k2-status-doing)', items: d?.inProgress ?? [], emptyKey: 'myTasks.empty.inProgress' },
      { key: 'done', labelKey: 'myTasks.groups.done', icon: 'check_circle', color: 'var(--k2-status-done)', items: d?.done ?? [], emptyKey: 'myTasks.empty.done' },
      { key: 'late', labelKey: 'myTasks.groups.overdue', icon: 'alarm', color: 'var(--k2-danger)', items: d?.overdue ?? [], emptyKey: 'myTasks.empty.overdue' },
    ];
  });

  constructor() {
    this.load();
    inject(DataEventsService).changes().pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.load());
  }

  errorText(): string {
    return apiErrorMessage(this.error(), 'errors.loadMyTasks');
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.my().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.error.set(e); },
    });
  }
}
