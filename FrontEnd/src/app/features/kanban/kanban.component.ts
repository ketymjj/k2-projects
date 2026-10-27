import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { t } from '../../core/i18n/i18n-state';
import { ProjectsApi, TasksApi } from '../../core/services/api.services';
import { DataEventsService } from '../../core/services/data-events.service';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent, PriorityBadgeComponent } from '../../shared/components/badges.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/components/states.component';
import { TASK_STATUSES, optionOf } from '../../shared/models/labels';
import { ProjectLookup, TaskItem, TaskStatus } from '../../shared/models/models';
import { apiErrorMessage, formatDate } from '../../shared/utils';
import { TaskDialogsService } from '../tasks/task-dialogs.service';

type Columns = Record<TaskStatus, TaskItem[]>;
const STORAGE_KEY = 'k2.kanban.project';

@Component({
  selector: 'k2-kanban',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, FormsModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatTooltipModule, MatProgressBarModule, TranslocoPipe, PageHeaderComponent, LoadingComponent,
    ErrorStateComponent, EmptyStateComponent, AvatarComponent, PriorityBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <k2-page-header [title]="'kanban.title' | transloco" [subtitle]="'kanban.subtitle' | transloco">
        <mat-form-field class="project-select" subscriptSizing="dynamic">
          <mat-label>{{ 'common.project' | transloco }}</mat-label>
          <mat-select [ngModel]="projectId()" (ngModelChange)="selectProject($event)">
            @for (p of projects(); track p.id) { <mat-option [value]="p.id">{{ p.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (canManage()) {
          <button mat-flat-button class="btn-gradient" (click)="create('AFazer')"><mat-icon>add</mat-icon> {{ 'tasks.new' | transloco }}</button>
        }
      </k2-page-header>

      @if (loadingProjects()) {
        <k2-loading />
      } @else if (projects().length === 0) {
        <div class="card"><k2-empty icon="view_kanban" [title]="'kanban.noProjectsTitle' | transloco" [message]="'kanban.noProjectsMessage' | transloco" /></div>
      } @else if (error()) {
        <div class="card"><k2-error [message]="errorText()" (retry)="loadBoard()" /></div>
      } @else {
        @if (loading()) { <mat-progress-bar mode="indeterminate" class="bar" /> }
        <div class="board" cdkDropListGroup>
          @for (col of statuses; track col.value) {
            <section class="column">
              <header class="col-head">
                <span class="dot" [style.background]="col.color"></span>
                <h3>{{ col.labelKey | transloco }}</h3>
                <span class="count">{{ columns()[col.value].length }}</span>
                <span class="spacer"></span>
                @if (canManage()) {
                  <button mat-icon-button (click)="create(col.value)"
                          [matTooltip]="'kanban.newIn' | transloco: { column: (col.labelKey | transloco) }"
                          [attr.aria-label]="'kanban.newIn' | transloco: { column: (col.labelKey | transloco) }"><mat-icon>add</mat-icon></button>
                }
              </header>
              <div class="list" cdkDropList [id]="col.value" [cdkDropListData]="columns()[col.value]" (cdkDropListDropped)="drop($event)">
                @for (task of columns()[col.value]; track task.id) {
                  <article class="card task" cdkDrag [cdkDragData]="task" [cdkDragDisabled]="!task.canChangeStatus || saving()"
                           [class.overdue]="task.isOverdue" [class.locked]="!task.canChangeStatus" (click)="open(task)"
                           (cdkDragEnded)="lastDragEnd = now()">
                    <div class="task-placeholder" *cdkDragPlaceholder></div>
                    <div class="top">
                      <k2-priority [priority]="task.priority" />
                      @if (task.isOverdue) { <span class="late"><mat-icon>alarm</mat-icon> {{ 'tasks.detail.overdue' | transloco }}</span> }
                      @if (!task.canChangeStatus) { <mat-icon class="lock" [matTooltip]="'kanban.locked' | transloco">lock</mat-icon> }
                    </div>
                    <h4 [class.done]="task.status === 'Concluido'">{{ task.title }}</h4>
                    @if (task.parentTaskTitle) { <div class="parent muted small"><mat-icon>subdirectory_arrow_right</mat-icon>{{ task.parentTaskTitle }}</div> }
                    <footer>
                      <span class="due" [class.text-danger]="task.isOverdue"><mat-icon>event</mat-icon>{{ fmt(task.dueDate) }}</span>
                      @if (task.subtaskCount) { <span class="meta"><mat-icon>account_tree</mat-icon>{{ task.completedSubtaskCount }}/{{ task.subtaskCount }}</span> }
                      @if (task.commentCount) { <span class="meta"><mat-icon>chat_bubble</mat-icon>{{ task.commentCount }}</span> }
                      <span class="spacer"></span>
                      <k2-avatar [name]="task.assignedToName" [size]="26" [tooltip]="true" />
                    </footer>
                  </article>
                } @empty {
                  <div class="empty-col muted small">{{ 'kanban.dropHere' | transloco }}</div>
                }
              </div>
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .project-select { min-width: 260px; }
    .bar { margin-bottom: 8px; border-radius: 4px; }
    .board { display: grid; grid-template-columns: repeat(3, minmax(280px, 1fr)); gap: 16px; align-items: start; overflow-x: auto; padding-bottom: 8px; }
    .column { background: var(--k2-surface-2); border: 1px solid var(--k2-border); border-radius: var(--k2-radius); padding: 12px; min-height: 300px; }
    .col-head { display: flex; align-items: center; gap: 8px; padding: 0 4px 10px; }
    .col-head h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; }
    .col-head .dot { width: 10px; height: 10px; border-radius: 50%; }
    .count { background: var(--k2-surface); border: 1px solid var(--k2-border); border-radius: 99px; padding: 0 8px; font-size: 12px; font-weight: 600; color: var(--k2-text-2); }
    .list { min-height: 220px; display: flex; flex-direction: column; gap: 10px; border-radius: 10px; transition: background .15s; }
    .list.cdk-drop-list-receiving, .list.cdk-drop-list-dragging { background: color-mix(in srgb, var(--k2-primary) 6%, transparent); }
    .task { padding: 12px 14px; cursor: grab; transition: box-shadow .15s, transform .15s; border-left: 4px solid transparent; }
    .task:hover { box-shadow: var(--k2-shadow-lg); }
    .task.locked { cursor: pointer; }
    .task.overdue { border-left-color: var(--k2-danger); }
    .top { display: flex; align-items: center; gap: 8px; }
    .late { display: inline-flex; align-items: center; gap: 2px; color: var(--k2-danger); font-size: 12px; font-weight: 600; }
    .late mat-icon, .lock { font-size: 15px; width: 15px; height: 15px; }
    .lock { margin-left: auto; color: var(--k2-text-muted); }
    h4 { font-size: 14px; font-weight: 600; margin: 10px 0 6px; line-height: 1.35; }
    h4.done { text-decoration: line-through; color: var(--k2-text-muted); }
    .parent { display: flex; align-items: center; gap: 2px; margin-bottom: 6px; }
    .parent mat-icon { font-size: 14px; width: 14px; height: 14px; }
    footer { display: flex; align-items: center; gap: 10px; color: var(--k2-text-muted); font-size: 12px; margin-top: 6px; }
    .due, .meta { display: inline-flex; align-items: center; gap: 3px; }
    footer mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .empty-col { border: 2px dashed var(--k2-border); border-radius: 10px; padding: 24px; text-align: center; }
    .task-placeholder { min-height: 80px; border: 2px dashed var(--k2-primary); border-radius: 12px; background: var(--k2-primary-soft); }
    .cdk-drag-preview { box-shadow: var(--k2-shadow-lg); transform: rotate(2deg); }
    .cdk-drag-animating, .list.cdk-drop-list-dragging .task:not(.cdk-drag-placeholder) { transition: transform 200ms cubic-bezier(0, 0, 0.2, 1); }
    @media (max-width: 960px) { .board { grid-template-columns: repeat(3, 85vw); } }
  `,
})
export class KanbanComponent {
  private readonly projectsApi = inject(ProjectsApi);
  private readonly tasksApi = inject(TasksApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(TaskDialogsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly statuses = TASK_STATUSES;
  readonly projects = signal<ProjectLookup[]>([]);
  readonly projectId = signal<string | null>(null);
  readonly canManage = signal(false);
  readonly columns = signal<Columns>({ AFazer: [], EmAndamento: [], Concluido: [] });
  readonly loadingProjects = signal(true);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<unknown>(null);
  readonly fmt = formatDate;

  /** Momento do último arraste, para não abrir os detalhes com o clique que encerra o arraste. */
  lastDragEnd = 0;
  readonly now = () => Date.now();

  constructor() {
    this.projectsApi.lookup().subscribe({
      next: (list) => {
        this.projects.set(list);
        this.loadingProjects.set(false);
        const fromUrl = this.route.snapshot.queryParamMap.get('project');
        let saved: string | null = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* indisponível */ }
        const initial = [fromUrl, saved].find((id) => id && list.some((p) => p.id === id)) ?? list[0]?.id ?? null;
        if (initial) this.selectProject(initial);
      },
      error: (e) => { this.loadingProjects.set(false); this.error.set(e); },
    });

    // Alterações feitas em outras telas ou por outros usuários
    inject(DataEventsService).changes().pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((c) => {
      if (!this.saving() && (!c.projectId || c.projectId === this.projectId())) this.loadBoard(true);
    });
  }

  errorText(): string {
    return apiErrorMessage(this.error(), 'errors.loadBoard');
  }

  selectProject(id: string): void {
    this.projectId.set(id);
    this.canManage.set(this.projects().find((p) => p.id === id)?.canManage ?? false);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* indisponível */ }
    this.router.navigate([], { queryParams: { project: id }, replaceUrl: true });
    this.loadBoard();
  }

  loadBoard(silent = false): void {
    const id = this.projectId();
    if (!id) return;
    if (!silent) this.loading.set(true);
    this.error.set(null);
    this.projectsApi.board(id).subscribe({
      next: (tasks) => {
        this.columns.set({
          AFazer: tasks.filter((task) => task.status === 'AFazer'),
          EmAndamento: tasks.filter((task) => task.status === 'EmAndamento'),
          Concluido: tasks.filter((task) => task.status === 'Concluido'),
        });
        this.loading.set(false);
      },
      error: (e) => { this.loading.set(false); this.error.set(e); },
    });
  }

  /** Atualização otimista: move o cartão na tela, salva na API e restaura se houver erro. */
  drop(event: CdkDragDrop<TaskItem[]>): void {
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;

    const snapshot: Columns = {
      AFazer: [...this.columns().AFazer],
      EmAndamento: [...this.columns().EmAndamento],
      Concluido: [...this.columns().Concluido],
    };
    const task = event.item.data as TaskItem;
    const target = event.container.id as TaskStatus;
    const next: Columns = { AFazer: [...snapshot.AFazer], EmAndamento: [...snapshot.EmAndamento], Concluido: [...snapshot.Concluido] };
    const source = event.previousContainer.id as TaskStatus;

    if (source === target) {
      moveItemInArray(next[target], event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(next[source], next[target], event.previousIndex, event.currentIndex);
      next[target][event.currentIndex] = { ...task, status: target, isOverdue: target === 'Concluido' ? false : task.isOverdue };
    }
    this.columns.set(next);
    this.saving.set(true);

    this.tasksApi.move(task.id, target, event.currentIndex).subscribe({
      next: (updated) => {
        this.columns.update((cols) => ({ ...cols, [target]: cols[target].map((x) => (x.id === updated.id ? updated : x)) }));
        this.saving.set(false);
        if (source !== target) {
          const column = t(optionOf(TASK_STATUSES, target)?.labelKey ?? '');
          this.toast.success(t('kanban.moved', { title: updated.title, column }));
        }
      },
      error: (e) => {
        this.columns.set(snapshot);
        this.saving.set(false);
        this.toast.error(e, 'errors.moveTask');
      },
    });
  }

  open(task: TaskItem): void {
    if (Date.now() - this.lastDragEnd < 250) return;
    this.dialogs.openDetail(task.id);
  }

  create(status: TaskStatus): void {
    const projectId = this.projectId();
    if (projectId) this.dialogs.openForm({ projectId, status });
  }
}
