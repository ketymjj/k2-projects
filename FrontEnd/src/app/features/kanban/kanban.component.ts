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
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PriorityBadgeComponent } from '../../shared/components/priority-badge/priority-badge.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
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
  templateUrl: './kanban.component.html',
  styleUrl: './kanban.component.scss',
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
