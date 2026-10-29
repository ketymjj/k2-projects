import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { t } from '../../../core/i18n/i18n-state';
import { ProjectsApi, TasksApi } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../../shared/models/labels';
import { IsoDate, ProjectLookup, TaskDetail, TaskItem, TaskPriority, TaskRequest, TaskStatus } from '../../../shared/models/models';
import { apiFieldErrors, fromIsoDate, toIsoDate } from '../../../shared/utils';

export interface TaskFormData {
  task?: TaskDetail;
  projectId?: string;
  parentTaskId?: string;
  status?: TaskStatus;
  dueDate?: IsoDate;
}

interface PersonOption { id: string; name: string; isOwner: boolean; }

function dateOrderValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as Date | null;
  const due = group.get('dueDate')?.value as Date | null;
  return start && due && due < start ? { dateOrder: true } : null;
}

@Component({
  selector: 'k2-task-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-form-dialog.component.html',
  styleUrl: './task-form-dialog.component.scss',
})
export class TaskFormDialogComponent {
  readonly data = inject<TaskFormData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<TaskFormDialogComponent, TaskItem>);
  private readonly projectsApi = inject(ProjectsApi);
  private readonly tasksApi = inject(TasksApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isEdit = !!this.data.task;
  readonly statuses = TASK_STATUSES;
  readonly priorities = TASK_PRIORITIES;
  readonly projects = signal<ProjectLookup[]>([]);
  readonly loadingProjects = signal(true);
  readonly people = signal<PersonOption[]>([]);
  private readonly projectTasks = signal<TaskItem[]>([]);
  readonly saving = signal(false);
  readonly generalError = signal<string | null>(null);

  /** Exclui a própria tarefa e suas subtarefas diretas das opções de tarefa principal. */
  readonly parentOptions = computed(() => {
    const self = this.data.task?.task.id;
    return this.projectTasks().filter((task) => task.id !== self && task.parentTaskId !== self);
  });

  readonly form = new FormGroup({
    projectId: new FormControl<string | null>(null, Validators.required),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    description: new FormControl<string | null>(null, Validators.maxLength(4000)),
    status: new FormControl<TaskStatus>('AFazer', { nonNullable: true }),
    priority: new FormControl<TaskPriority>('Media', { nonNullable: true }),
    assignedToId: new FormControl<string | null>(null),
    parentTaskId: new FormControl<string | null>(null),
    startDate: new FormControl<Date | null>(null),
    dueDate: new FormControl<Date | null>(null),
  }, { validators: dateOrderValidator });

  constructor() {
    const task = this.data.task;
    if (task) {
      this.form.patchValue({
        projectId: task.task.projectId,
        title: task.task.title,
        description: task.description,
        status: task.task.status,
        priority: task.task.priority,
        assignedToId: task.task.assignedToId,
        parentTaskId: task.task.parentTaskId,
        startDate: fromIsoDate(task.task.startDate),
        dueDate: fromIsoDate(task.task.dueDate),
      });
    } else {
      this.form.patchValue({
        projectId: this.data.projectId ?? null,
        parentTaskId: this.data.parentTaskId ?? null,
        status: this.data.status ?? 'AFazer',
        dueDate: fromIsoDate(this.data.dueDate),
      });
    }
    if (this.isEdit || this.data.parentTaskId) this.form.controls.projectId.disable();

    this.projectsApi.lookup().subscribe({
      next: (list) => {
        this.projects.set(list.filter((p) => p.canManage || p.id === this.form.controls.projectId.value));
        this.loadingProjects.set(false);
      },
      error: (e) => { this.loadingProjects.set(false); this.toast.error(e); },
    });

    this.form.controls.projectId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      if (!this.isEdit) { this.form.controls.assignedToId.setValue(null); if (!this.data.parentTaskId) this.form.controls.parentTaskId.setValue(null); }
      this.loadProjectData(id);
    });
    this.loadProjectData(this.form.controls.projectId.value);
  }

  private loadProjectData(projectId: string | null): void {
    if (!projectId) { this.people.set([]); this.projectTasks.set([]); return; }
    forkJoin({
      detail: this.projectsApi.get(projectId),
      tasks: this.tasksApi.list({ projectId, pageSize: 500, sortBy: 'title' }),
    }).subscribe({
      next: ({ detail, tasks }) => {
        const owner = { id: detail.project.ownerId, name: detail.project.ownerName, isOwner: true };
        this.people.set([owner, ...detail.members.map((m) => ({ id: m.userId, name: m.name, isOwner: false }))]);
        this.projectTasks.set(tasks.items);
      },
      error: (e) => this.toast.error(e),
    });
  }

  save(): void {
    this.generalError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: TaskRequest = {
      projectId: v.projectId!,
      title: v.title.trim(),
      description: v.description?.trim() || null,
      status: v.status,
      priority: v.priority,
      assignedToId: v.assignedToId,
      startDate: toIsoDate(v.startDate),
      dueDate: toIsoDate(v.dueDate),
      parentTaskId: v.parentTaskId,
    };
    this.saving.set(true);
    const request = this.isEdit ? this.tasksApi.update(this.data.task!.task.id, body) : this.tasksApi.create(body);
    request.subscribe({
      next: (task) => {
        this.toast.success(t(this.isEdit ? 'tasks.toast.updated' : 'tasks.toast.created'));
        this.ref.close(task);
      },
      error: (e) => {
        this.saving.set(false);
        const fields = apiFieldErrors(e);
        let mapped = false;
        for (const [key, message] of Object.entries(fields)) {
          const control = this.form.get(key);
          if (control) { control.setErrors({ server: message }); control.markAsTouched(); mapped = true; }
        }
        if (!mapped) this.toast.error(e);
        else this.generalError.set(Object.values(fields)[0]);
      },
    });
  }
}
