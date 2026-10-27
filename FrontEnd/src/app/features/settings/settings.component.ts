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
import { AvatarComponent, RoleBadgeComponent } from '../../shared/components/badges.component';
import { FlagComponent } from '../../shared/components/language-selector.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { apiErrorMessage, apiFieldErrors } from '../../shared/utils';
import { PASSWORD_PATTERN } from '../users/user-form-dialog.component';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('newPassword')?.value === group.get('confirm')?.value ? null : { mismatch: true };
}

/** Perfil do usuário e preferências locais (não é um módulo administrativo). */
@Component({
  selector: 'k2-settings',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatButtonToggleModule, MatSlideToggleModule,
    MatIconModule, MatProgressSpinnerModule, TranslocoPipe, PageHeaderComponent, AvatarComponent, RoleBadgeComponent, FlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <k2-page-header [title]="'settings.title' | transloco" [subtitle]="'settings.subtitle' | transloco" />

      <div class="card card-pad section">
        <div class="profile-head">
          <k2-avatar [name]="auth.user()?.name ?? null" [size]="56" />
          <div>
            <h3>{{ auth.user()?.name }}</h3>
            @if (auth.user(); as u) { <k2-role [role]="u.role" /> }
          </div>
        </div>
        <form [formGroup]="profile" (ngSubmit)="saveProfile()" class="form-grid" novalidate>
          <mat-form-field>
            <mat-label>{{ 'settings.name' | transloco }}</mat-label>
            <input matInput formControlName="name" maxlength="120" />
            @if (profile.controls.name.hasError('required')) { <mat-error>{{ 'validation.nameRequired' | transloco }}</mat-error> }
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'settings.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" />
            @if (profile.controls.email.hasError('required')) { <mat-error>{{ 'validation.emailRequired' | transloco }}</mat-error> }
            @else if (profile.controls.email.hasError('email')) { <mat-error>{{ 'validation.emailInvalid' | transloco }}</mat-error> }
            @if (profile.controls.email.hasError('server')) { <mat-error>{{ profile.controls.email.getError('server') }}</mat-error> }
          </mat-form-field>
          <div class="full actions">
            <button mat-flat-button class="btn-gradient" type="submit" [disabled]="savingProfile() || profile.pristine">
              @if (savingProfile()) { <mat-spinner diameter="18" /> } @else { {{ 'settings.saveProfile' | transloco }} }
            </button>
          </div>
        </form>
      </div>

      <div class="card card-pad section">
        <div class="card-title"><mat-icon>lock</mat-icon> {{ 'settings.changePassword' | transloco }}</div>
        <form [formGroup]="password" (ngSubmit)="savePassword()" class="form-grid" novalidate>
          <mat-form-field class="full">
            <mat-label>{{ 'settings.currentPassword' | transloco }}</mat-label>
            <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" />
            @if (password.controls.currentPassword.hasError('required')) { <mat-error>{{ 'validation.currentPasswordRequired' | transloco }}</mat-error> }
            @if (password.controls.currentPassword.hasError('server')) { <mat-error>{{ password.controls.currentPassword.getError('server') }}</mat-error> }
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'settings.newPassword' | transloco }}</mat-label>
            <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
            <mat-hint>{{ 'settings.passwordHint' | transloco }}</mat-hint>
            @if (password.controls.newPassword.hasError('required')) { <mat-error>{{ 'validation.newPasswordRequired' | transloco }}</mat-error> }
            @else if (password.controls.newPassword.hasError('pattern')) { <mat-error>{{ 'validation.passwordPattern' | transloco }}</mat-error> }
            @if (password.controls.newPassword.hasError('server')) { <mat-error>{{ password.controls.newPassword.getError('server') }}</mat-error> }
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'settings.confirmPassword' | transloco }}</mat-label>
            <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          </mat-form-field>
          @if (password.hasError('mismatch') && password.controls.confirm.touched) { <p class="full error">{{ 'validation.passwordsMismatch' | transloco }}</p> }
          <div class="full actions">
            <button mat-flat-button type="submit" [disabled]="savingPassword()">
              @if (savingPassword()) { <mat-spinner diameter="18" /> } @else { {{ 'settings.changePasswordButton' | transloco }} }
            </button>
          </div>
        </form>
      </div>

      <div class="card card-pad section">
        <div class="card-title"><mat-icon>tune</mat-icon> {{ 'settings.preferences' | transloco }}</div>
        <div class="pref">
          <div><strong>{{ 'settings.language' | transloco }}</strong><span class="muted small">{{ 'settings.languageHint' | transloco }}</span></div>
          <mat-button-toggle-group [value]="i18n.lang()" (change)="setLanguage($event.value)" hideSingleSelectionIndicator [attr.aria-label]="'settings.language' | transloco">
            @for (o of languages; track o.code) {
              <mat-button-toggle [value]="o.code"><span class="lang-opt"><k2-flag [lang]="o.code" /> {{ o.short }}</span></mat-button-toggle>
            }
          </mat-button-toggle-group>
        </div>
        <div class="pref">
          <div><strong>{{ 'settings.theme' | transloco }}</strong><span class="muted small">{{ 'settings.themeHint' | transloco }}</span></div>
          <mat-button-toggle-group [value]="prefs.preferences().theme" (change)="setTheme($event.value)" hideSingleSelectionIndicator>
            <mat-button-toggle value="light"><mat-icon>light_mode</mat-icon> {{ 'settings.light' | transloco }}</mat-button-toggle>
            <mat-button-toggle value="dark"><mat-icon>dark_mode</mat-icon> {{ 'settings.dark' | transloco }}</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
        <div class="pref">
          <div><strong>{{ 'settings.realtimeToasts' | transloco }}</strong><span class="muted small">{{ 'settings.realtimeToastsHint' | transloco }}</span></div>
          <mat-slide-toggle [checked]="prefs.preferences().realtimeToasts" (change)="prefs.update({ realtimeToasts: $event.checked })" [attr.aria-label]="'settings.realtimeToasts' | transloco" />
        </div>
      </div>
    </div>
  `,
  styles: `
    .narrow { max-width: 820px; }
    .section { margin-bottom: 16px; }
    .profile-head { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .profile-head h3 { font-size: 18px; margin-bottom: 6px; }
    .actions { display: flex; justify-content: flex-end; }
    .error { color: var(--k2-danger); font-size: 13px; margin: 0; }
    .pref { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--k2-border); flex-wrap: wrap; }
    .pref > div { display: flex; flex-direction: column; gap: 2px; }
    .pref mat-icon { font-size: 18px; width: 18px; height: 18px; vertical-align: middle; }
    .lang-opt { display: inline-flex; align-items: center; gap: 8px; }
  `,
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
