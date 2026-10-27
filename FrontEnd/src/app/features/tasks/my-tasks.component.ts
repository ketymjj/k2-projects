import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { TasksApi } from '../../core/services/api.services';
import { DataEventsService } from '../../core/services/data-events.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/components/states.component';
import { MyTasks } from '../../shared/models/models';
import { apiErrorMessage } from '../../shared/utils';
import { TaskTableComponent } from './task-table.component';

/** Tarefas atribuídas ao usuário autenticado, agrupadas por situação. */
@Component({
  selector: 'k2-my-tasks',
  imports: [MatTabsModule, MatIconModule, TranslocoPipe, PageHeaderComponent, LoadingComponent, ErrorStateComponent, EmptyStateComponent, TaskTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <k2-page-header [title]="'myTasks.title' | transloco" [subtitle]="'myTasks.subtitle' | transloco" />

      @if (data()) {
        <div class="summary">
          @for (g of groups(); track g.key) {
            <button class="card stat" [class.active]="selected() === $index" (click)="selected.set($index)">
              <span class="icon" [style.color]="g.color"><mat-icon>{{ g.icon }}</mat-icon></span>
              <span><strong>{{ g.items.length }}</strong><span class="muted">{{ g.labelKey | transloco }}</span></span>
            </button>
          }
        </div>
      }

      <div class="card">
        @if (loading() && !data()) {
          <k2-loading />
        } @else if (error()) {
          <k2-error [message]="errorText()" (retry)="load()" />
        } @else {
          <mat-tab-group [selectedIndex]="selected()" (selectedIndexChange)="selected.set($event)" mat-stretch-tabs="false">
            @for (g of groups(); track g.key) {
              <mat-tab [label]="(g.labelKey | transloco) + ' (' + g.items.length + ')'">
                @if (g.items.length) {
                  <k2-task-table [tasks]="g.items" />
                } @else {
                  <k2-empty [icon]="g.icon" [title]="g.emptyKey | transloco" />
                }
              </mat-tab>
            }
          </mat-tab-group>
        }
      </div>
    </div>
  `,
  styles: `
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .stat { display: flex; align-items: center; gap: 14px; padding: 16px; cursor: pointer; text-align: left; font: inherit; color: inherit; transition: transform .15s, box-shadow .15s; }
    .stat:hover { transform: translateY(-2px); box-shadow: var(--k2-shadow-lg); }
    .stat.active { outline: 2px solid var(--k2-primary); }
    .stat .icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: var(--k2-surface-2); }
    .stat strong { display: block; font-size: 22px; }
    @media (max-width: 800px) { .summary { grid-template-columns: repeat(2, 1fr); } }
  `,
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
