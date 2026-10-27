import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { t } from '../../core/i18n/i18n-state';
import { UsersApi } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { USER_ROLES } from '../../shared/models/labels';
import { User, UserRole } from '../../shared/models/models';
import { apiErrorMessage, apiFieldErrors } from '../../shared/utils';

/** Mesmas regras de senha do backend: 8+ caracteres, com letras e números. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

@Component({
  selector: 'k2-user-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatButtonModule, MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (user ? 'users.form.editTitle' : 'users.form.newTitle') | transloco }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          <mat-form-field class="full">
            <mat-label>{{ 'users.form.name' | transloco }}</mat-label>
            <input matInput formControlName="name" maxlength="120" />
            @if (form.controls.name.hasError('required')) { <mat-error>{{ 'validation.nameRequired' | transloco }}</mat-error> }
            @if (form.controls.name.hasError('server')) { <mat-error>{{ form.controls.name.getError('server') }}</mat-error> }
          </mat-form-field>
          <mat-form-field class="full">
            <mat-label>{{ 'users.form.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" maxlength="160" />
            @if (form.controls.email.hasError('required')) { <mat-error>{{ 'validation.emailRequired' | transloco }}</mat-error> }
            @else if (form.controls.email.hasError('email')) { <mat-error>{{ 'validation.emailInvalid' | transloco }}</mat-error> }
            @if (form.controls.email.hasError('server')) { <mat-error>{{ form.controls.email.getError('server') }}</mat-error> }
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'users.form.role' | transloco }}</mat-label>
            <mat-select formControlName="role">
              @for (r of roles; track r.value) { <mat-option [value]="r.value">{{ r.labelKey | transloco }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ (user ? 'users.form.newPassword' : 'users.form.password') | transloco }}</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
            <mat-hint>{{ 'validation.passwordHint' | transloco }}</mat-hint>
            @if (form.controls.password.hasError('required')) { <mat-error>{{ 'validation.passwordRequired' | transloco }}</mat-error> }
            @else if (form.controls.password.hasError('pattern')) { <mat-error>{{ 'validation.passwordPattern' | transloco }}</mat-error> }
            @if (form.controls.password.hasError('server')) { <mat-error>{{ form.controls.password.getError('server') }}</mat-error> }
          </mat-form-field>
          @if (user) {
            <mat-slide-toggle formControlName="active" class="full">{{ 'users.form.active' | transloco }}</mat-slide-toggle>
          }
        </div>
        @if (isSelf) { <p class="muted small">{{ 'users.form.selfWarning' | transloco }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button class="btn-gradient" type="submit" [disabled]="saving()">
          @if (saving()) { <mat-spinner diameter="18" /> } @else { {{ 'common.save' | transloco }} }
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `mat-dialog-content { padding-top: 8px !important; } mat-slide-toggle { margin: 8px 0; }`,
})
export class UserFormDialogComponent {
  readonly user = inject<User | null>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<UserFormDialogComponent, User>);
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);
  readonly isSelf = this.user?.id === inject(AuthService).user()?.id;
  readonly roles = USER_ROLES;
  readonly saving = signal(false);

  readonly form = new FormGroup({
    name: new FormControl(this.user?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    email: new FormControl(this.user?.email ?? '', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl<UserRole>(this.user?.role ?? 'Colaborador', { nonNullable: true }),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.user ? [Validators.pattern(PASSWORD_PATTERN)] : [Validators.required, Validators.pattern(PASSWORD_PATTERN)],
    }),
    active: new FormControl(this.user?.active ?? true, { nonNullable: true }),
  });

  constructor() {
    if (this.isSelf) { this.form.controls.role.disable(); this.form.controls.active.disable(); }
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    const req = this.user
      ? this.api.update(this.user.id, { name: v.name.trim(), email: v.email.trim(), role: v.role, active: v.active, newPassword: v.password || null })
      : this.api.create({ name: v.name.trim(), email: v.email.trim(), password: v.password, role: v.role });
    req.subscribe({
      next: (u) => { this.toast.success(t(this.user ? 'users.toast.updated' : 'users.toast.created')); this.ref.close(u); },
      error: (e) => {
        this.saving.set(false);
        if (e?.status === 409) this.form.controls.email.setErrors({ server: apiErrorMessage(e) });
        for (const [k, m] of Object.entries(apiFieldErrors(e))) this.form.get(k === 'newPassword' ? 'password' : k)?.setErrors({ server: m });
        this.toast.error(e);
      },
    });
  }
}
