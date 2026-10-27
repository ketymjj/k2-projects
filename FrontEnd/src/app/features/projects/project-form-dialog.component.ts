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
import { AuthService } from '../../core/auth/auth.service';
import { t } from '../../core/i18n/i18n-state';
import { ProjectsApi, UsersApi } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { PROJECT_STATUSES, USER_ROLES, optionOf } from '../../shared/models/labels';
import { ProjectListItem, ProjectRequest, ProjectStatus, UserLookup } from '../../shared/models/models';
import { apiFieldErrors, fromIsoDate, toIsoDate } from '../../shared/utils';

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
  template: `
    <h2 mat-dialog-title>{{ (project ? 'projects.form.editTitle' : 'projects.form.newTitle') | transloco }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field class="full">
            <mat-label>{{ 'projects.form.name' | transloco }}</mat-label>
            <input matInput formControlName="name" maxlength="150" />
            @if (form.controls.name.hasError('required')) { <mat-error>{{ 'validation.projectNameRequired' | transloco }}</mat-error> }
            @if (form.controls.name.hasError('minlength')) { <mat-error>{{ 'validation.projectNameMin' | transloco }}</mat-error> }
            @if (form.controls.name.hasError('server')) { <mat-error>{{ form.controls.name.getError('server') }}</mat-error> }
          </mat-form-field>
          <mat-form-field class="full">
            <mat-label>{{ 'projects.form.description' | transloco }}</mat-label>
            <textarea matInput formControlName="description" rows="3" maxlength="2000"></textarea>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'projects.form.status' | transloco }}</mat-label>
            <mat-select formControlName="status">
              @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.labelKey | transloco }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'projects.form.owner' | transloco }}</mat-label>
            <mat-select formControlName="ownerId">
              @for (u of owners(); track u.id) { <mat-option [value]="u.id">{{ u.name }} ({{ roleKey(u) | transloco }})</mat-option> }
            </mat-select>
            @if (!auth.isAdmin()) { <mat-hint>{{ 'projects.form.ownerHint' | transloco }}</mat-hint> }
            @if (form.controls.ownerId.hasError('server')) { <mat-error>{{ form.controls.ownerId.getError('server') }}</mat-error> }
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'projects.form.start' | transloco }}</mat-label>
            <input matInput [matDatepicker]="sp" formControlName="startDate" />
            <mat-datepicker-toggle matIconSuffix [for]="sp" /><mat-datepicker #sp />
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'projects.form.delivery' | transloco }}</mat-label>
            <input matInput [matDatepicker]="dp" formControlName="dueDate" />
            <mat-datepicker-toggle matIconSuffix [for]="dp" /><mat-datepicker #dp />
          </mat-form-field>
          @if (!project) {
            <mat-form-field class="full">
              <mat-label>{{ 'projects.form.initialMembers' | transloco }}</mat-label>
              <mat-select formControlName="memberIds" multiple>
                @for (u of users(); track u.id) { <mat-option [value]="u.id">{{ u.name }}</mat-option> }
              </mat-select>
              <mat-hint>{{ 'projects.form.initialMembersHint' | transloco }}</mat-hint>
            </mat-form-field>
          }
        </div>
        @if (form.hasError('dateOrder') && (form.touched || form.dirty)) {
          <p class="form-error">{{ 'validation.projectDateOrder' | transloco }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button class="btn-gradient" type="submit" [disabled]="saving()">
          @if (saving()) { <mat-spinner diameter="18" /> } @else { {{ (project ? 'common.saveChanges' : 'projects.form.create') | transloco }} }
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.form-error { color: var(--k2-danger); font-size: 13px; margin: 4px 0 0; } mat-dialog-content { padding-top: 8px !important; }`,
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
