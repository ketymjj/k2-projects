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
import { AuthService } from '../../../core/auth/auth.service';
import { t } from '../../../core/i18n/i18n-state';
import { UsersApi } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { USER_ROLES } from '../../../shared/models/labels';
import { User, UserRole } from '../../../shared/models/models';
import { apiErrorMessage, apiFieldErrors } from '../../../shared/utils';

/** Mesmas regras de senha do backend: 8+ caracteres, com letras e números. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

@Component({
  selector: 'k2-user-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatButtonModule, MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form-dialog.component.html',
  styleUrl: './user-form-dialog.component.scss',
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
