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
import { t } from '../../core/i18n/i18n-state';
import { ProjectsApi, TasksApi } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../shared/models/labels';
import { IsoDate, ProjectLookup, TaskDetail, TaskItem, TaskPriority, TaskRequest, TaskStatus } from '../../shared/models/models';
import { apiFieldErrors, fromIsoDate, toIsoDate } from '../../shared/utils';

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
  template: `
    <h2 mat-dialog-title>{{ (isEdit ? 'tasks.edit' : (data.parentTaskId ? 'tasks.newSubtask' : 'tasks.new')) | transloco }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field class="full">
            <mat-label>{{ 'tasks.form.project' | transloco }}</mat-label>
            <mat-select formControlName="projectId">
              @for (p of projects(); track p.id) { <mat-option [value]="p.id">{{ p.name }}</mat-option> }
            </mat-select>
            @if (form.controls.projectId.hasError('required')) { <mat-error>{{ 'validation.projectRequired' | transloco }}</mat-error> }
            @if (!loadingProjects() && projects().length === 0) { <mat-hint>{{ 'tasks.form.noManagedProjects' | transloco }}</mat-hint> }
          </mat-form-field>

          <mat-form-field class="full">
            <mat-label>{{ 'tasks.form.title' | transloco }}</mat-label>
            <input matInput formControlName="title" maxlength="200" />
            @if (form.controls.title.hasError('required')) { <mat-error>{{ 'validation.titleRequired' | transloco }}</mat-error> }
            @if (form.controls.title.hasError('server')) { <mat-error>{{ form.controls.title.getError('server') }}</mat-error> }
          </mat-form-field>

          <mat-form-field class="full">
            <mat-label>{{ 'tasks.form.description' | transloco }}</mat-label>
            <textarea matInput formControlName="description" rows="3" maxlength="4000"></textarea>
          </mat-form-field>

          <mat-form-field>
            <mat-label>{{ 'tasks.form.status' | transloco }}</mat-label>
            <mat-select formControlName="status">
              @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.labelKey | transloco }}</mat-option> }
            </mat-select>
          </mat-form-field>

          <mat-form-field>
            <mat-label>{{ 'tasks.form.priority' | transloco }}</mat-label>
            <mat-select formControlName="priority">
              @for (p of priorities; track p.value) { <mat-option [value]="p.value">{{ p.labelKey | transloco }}</mat-option> }
            </mat-select>
          </mat-form-field>

          <mat-form-field>
            <mat-label>{{ 'tasks.form.assignee' | transloco }}</mat-label>
            <mat-select formControlName="assignedToId">
              <mat-option [value]="null">{{ 'common.noAssignee' | transloco }}</mat-option>
              @for (u of people(); track u.id) {
                <mat-option [value]="u.id">{{ u.name }}@if (u.isOwner) { {{ ' ' + ('tasks.form.ownerSuffix' | transloco) }} }</mat-option>
              }
            </mat-select>
            <mat-hint>{{ 'tasks.form.assigneeHint' | transloco }}</mat-hint>
            @if (form.controls.assignedToId.hasError('server')) { <mat-error>{{ form.controls.assignedToId.getError('server') }}</mat-error> }
          </mat-form-field>

          <mat-form-field>
            <mat-label>{{ 'tasks.form.parent' | transloco }}</mat-label>
            <mat-select formControlName="parentTaskId">
              <mat-option [value]="null">{{ 'tasks.form.noParent' | transloco }}</mat-option>
              @for (task of parentOptions(); track task.id) { <mat-option [value]="task.id">{{ task.title }}</mat-option> }
            </mat-select>
            @if (form.controls.parentTaskId.hasError('server')) { <mat-error>{{ form.controls.parentTaskId.getError('server') }}</mat-error> }
          </mat-form-field>

          <mat-form-field>
            <mat-label>{{ 'tasks.form.start' | transloco }}</mat-label>
            <input matInput [matDatepicker]="startPicker" formControlName="startDate" />
            <mat-datepicker-toggle matIconSuffix [for]="startPicker" />
            <mat-datepicker #startPicker />
          </mat-form-field>

          <mat-form-field>
            <mat-label>{{ 'tasks.form.due' | transloco }}</mat-label>
            <input matInput [matDatepicker]="duePicker" formControlName="dueDate" />
            <mat-datepicker-toggle matIconSuffix [for]="duePicker" />
            <mat-datepicker #duePicker />
          </mat-form-field>
        </div>
        @if (form.hasError('dateOrder') && (form.touched || form.dirty)) {
          <p class="form-error">{{ 'validation.taskDateOrder' | transloco }}</p>
        }
        @if (generalError()) { <p class="form-error">{{ generalError() }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button class="btn-gradient" type="submit" [disabled]="saving()">
          @if (saving()) { <mat-spinner diameter="18" /> } @else { {{ (isEdit ? 'common.saveChanges' : 'tasks.form.create') | transloco }} }
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form-error { color: var(--k2-danger); font-size: 13px; margin: 4px 0 0; }
    mat-dialog-content { padding-top: 8px !important; }
  `,
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
