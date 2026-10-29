import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { t } from '../../../core/i18n/i18n-state';
import { ProjectsApi, UsersApi } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { PROJECT_STATUSES, USER_ROLES, optionOf } from '../../../shared/models/labels';
import { ProjectListItem, ProjectRequest, ProjectStatus, UserLookup } from '../../../shared/models/models';
import { apiFieldErrors, fromIsoDate, toIsoDate } from '../../../shared/utils';

function dateOrder(group: AbstractControl): ValidationErrors | null {
  const s = group.get('startDate')?.value as Date | null;
  const d = group.get('dueDate')?.value as Date | null;
  return s && d && d < s ? { dateOrder: true } : null;
}

@Component({
  selector: 'k2-project-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    MatButtonModule, MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-form-dialog.component.html',
  styleUrl: './project-form-dialog.component.scss',
})
export class ProjectFormDialogComponent {
  readonly project = inject<ProjectListItem | null>(MAT_DIALOG_DATA);
  readonly auth = inject(AuthService);
  private readonly ref = inject(MatDialogRef<ProjectFormDialogComponent, ProjectListItem>);
  private readonly api = inject(ProjectsApi);
  private readonly toast = inject(ToastService);

  readonly statuses = PROJECT_STATUSES;
  readonly users = signal<UserLookup[]>([]);
  readonly owners = signal<UserLookup[]>([]);
  readonly saving = signal(false);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3), Validators.maxLength(150)] }),
    description: new FormControl<string | null>(null, Validators.maxLength(2000)),
    status: new FormControl<ProjectStatus>('Planejado', { nonNullable: true }),
    ownerId: new FormControl<string | null>(null),
    startDate: new FormControl<Date | null>(null),
    dueDate: new FormControl<Date | null>(null),
    memberIds: new FormControl<string[]>([], { nonNullable: true }),
  }, { validators: dateOrder });

  constructor() {
    const p = this.project;
    this.form.patchValue(p
      ? { name: p.name, description: p.description, status: p.status, ownerId: p.ownerId, startDate: fromIsoDate(p.startDate), dueDate: fromIsoDate(p.dueDate) }
      : { ownerId: this.auth.user()?.id ?? null });
    if (!this.auth.isAdmin()) this.form.controls.ownerId.disable();

    inject(UsersApi).lookup().subscribe({
      next: (list) => {
        this.users.set(list);
        this.owners.set(list.filter((u) => u.role !== 'Colaborador'));
      },
      error: (e) => this.toast.error(e),
    });
  }

  roleKey(u: UserLookup): string {
    return optionOf(USER_ROLES, u.role)?.labelKey ?? '';
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body: ProjectRequest = {
      name: v.name.trim(),
      description: v.description?.trim() || null,
      status: v.status,
      ownerId: this.auth.isAdmin() ? v.ownerId : null,
      startDate: toIsoDate(v.startDate),
      dueDate: toIsoDate(v.dueDate),
      memberIds: this.project ? undefined : v.memberIds,
    };
    this.saving.set(true);
    const req = this.project ? this.api.update(this.project.id, body) : this.api.create(body);
    req.subscribe({
      next: (saved) => {
        this.toast.success(t(this.project ? 'projects.toast.updated' : 'projects.toast.created'));
        this.ref.close(saved);
      },
      error: (e) => {
        this.saving.set(false);
        const fields = apiFieldErrors(e);
        let mapped = false;
        for (const [key, msg] of Object.entries(fields)) {
          const c = this.form.get(key);
          if (c) { c.setErrors({ server: msg }); c.markAsTouched(); mapped = true; }
        }
        if (!mapped) this.toast.error(e);
      },
    });
  }
}
