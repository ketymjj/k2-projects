import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { AppLang, t } from '../../core/i18n/i18n-state';
import { I18nService, LANG_OPTIONS } from '../../core/i18n/i18n.service';
import { ProfileApi } from '../../core/services/api.services';
import { PreferencesService, ThemeMode } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { RoleBadgeComponent } from '../../shared/components/role-badge/role-badge.component';
import { FlagComponent } from '../../shared/components/flag/flag.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { apiErrorMessage, apiFieldErrors } from '../../shared/utils';
import { PASSWORD_PATTERN } from '../users/user-form-dialog/user-form-dialog.component';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('newPassword')?.value === group.get('confirm')?.value ? null : { mismatch: true };
}

/** Perfil do usuário e preferências locais (não é um módulo administrativo). */
@Component({
  selector: 'k2-settings',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatButtonToggleModule, MatSlideToggleModule,
    MatIconModule, MatProgressSpinnerModule, TranslocoPipe, PageHeaderComponent, AvatarComponent, RoleBadgeComponent, FlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  readonly prefs = inject(PreferencesService);
  readonly i18n = inject(I18nService);
  private readonly api = inject(ProfileApi);
  private readonly toast = inject(ToastService);
  readonly languages = LANG_OPTIONS;
  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);

  readonly profile = new FormGroup({
    name: new FormControl(this.auth.user()?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    email: new FormControl(this.auth.user()?.email ?? '', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  readonly password = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(PASSWORD_PATTERN)] }),
    confirm: new FormControl('', { nonNullable: true }),
  }, { validators: passwordsMatch });

  async setLanguage(lang: AppLang): Promise<void> {
    await this.i18n.use(lang);
    this.toast.success(t('language.changed'));
  }

  setTheme(theme: ThemeMode): void {
    this.prefs.update({ theme });
  }

  saveProfile(): void {
    if (this.profile.invalid) { this.profile.markAllAsTouched(); return; }
    this.savingProfile.set(true);
    const v = this.profile.getRawValue();
    this.api.update({ name: v.name.trim(), email: v.email.trim() }).subscribe({
      next: (user) => {
        this.auth.updateUser(user);
        this.profile.markAsPristine();
        this.savingProfile.set(false);
        this.toast.success(t('settings.profileUpdated'));
      },
      error: (e) => {
        this.savingProfile.set(false);
        if (e?.status === 409) this.profile.controls.email.setErrors({ server: apiErrorMessage(e) });
        this.toast.error(e);
      },
    });
  }

  savePassword(): void {
    if (this.password.invalid) { this.password.markAllAsTouched(); return; }
    this.savingPassword.set(true);
    const v = this.password.getRawValue();
    this.api.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }).subscribe({
      next: () => {
        this.password.reset();
        this.savingPassword.set(false);
        this.toast.success(t('settings.passwordChanged'));
      },
      error: (e) => {
        this.savingPassword.set(false);
        const fields = apiFieldErrors(e);
        if (fields['currentPassword']) this.password.controls.currentPassword.setErrors({ server: fields['currentPassword'] });
        if (fields['newPassword']) this.password.controls.newPassword.setErrors({ server: fields['newPassword'] });
        this.toast.error(e);
      },
    });
  }
}
