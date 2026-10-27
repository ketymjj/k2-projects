import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageSelectorComponent } from '../../shared/components/language-selector.component';
import { apiErrorMessage } from '../../shared/utils';
import { AuthService } from './auth.service';

@Component({
  selector: 'k2-login',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    TranslocoPipe, LanguageSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login">
      <section class="brand">
        <div class="logo"><span>K2</span></div>
        <h1>{{ 'app.name' | transloco }}</h1>
        <p>{{ 'auth.brandText' | transloco }}</p>
        <ul>
          <li><mat-icon>view_kanban</mat-icon> {{ 'auth.features.kanban' | transloco }}</li>
          <li><mat-icon>calendar_month</mat-icon> {{ 'auth.features.calendar' | transloco }}</li>
          <li><mat-icon>notifications_active</mat-icon> {{ 'auth.features.realtime' | transloco }}</li>
          <li><mat-icon>insights</mat-icon> {{ 'auth.features.dashboard' | transloco }}</li>
        </ul>
      </section>

      <section class="form-side">
        <div class="lang"><k2-language-selector /></div>
        <form class="card form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <h2>{{ 'auth.title' | transloco }}</h2>
          <p class="muted">{{ 'auth.subtitle' | transloco }}</p>

          @if (expired()) {
            <div class="alert warn"><mat-icon>schedule</mat-icon> {{ 'auth.sessionExpired' | transloco }}</div>
          }
          @if (error()) {
            <div class="alert error" role="alert"><mat-icon>error_outline</mat-icon> {{ errorText() }}</div>
          }

          <mat-form-field appearance="outline">
            <mat-label>{{ 'auth.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" />
            <mat-icon matPrefix>mail</mat-icon>
            @if (form.controls.email.hasError('required')) { <mat-error>{{ 'validation.emailRequired' | transloco }}</mat-error> }
            @else if (form.controls.email.hasError('email')) { <mat-error>{{ 'validation.emailInvalid' | transloco }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'auth.password' | transloco }}</mat-label>
            <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" />
            <mat-icon matPrefix>lock</mat-icon>
            <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())"
                    [attr.aria-label]="(showPassword() ? 'auth.hidePassword' : 'auth.showPassword') | transloco">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (form.controls.password.hasError('required')) { <mat-error>{{ 'validation.passwordRequired' | transloco }}</mat-error> }
          </mat-form-field>

          <button mat-flat-button class="btn-gradient submit" type="submit" [disabled]="loading()">
            @if (loading()) { <mat-spinner diameter="20" /> } @else { {{ 'auth.submit' | transloco }} }
          </button>
        </form>
      </section>
    </div>
  `,
  styles: `
    .login { min-height: 100vh; display: grid; grid-template-columns: 1.1fr 1fr; }
    .brand { background: radial-gradient(circle at 20% 20%, #4a63ff 0, transparent 45%), radial-gradient(circle at 80% 80%, #8b5cf6 0, transparent 45%), #10153a;
             color: #fff; padding: 64px; display: flex; flex-direction: column; justify-content: center; gap: 16px; }
    .logo { width: 56px; height: 56px; border-radius: 16px; background: var(--k2-gradient); display: grid; place-items: center; font-weight: 800; font-size: 20px; box-shadow: 0 10px 30px rgba(124,77,255,.45); }
    .brand h1 { color: #fff; font-size: 34px; letter-spacing: 0.04em; }
    .brand p { color: #c7cdf2; max-width: 440px; font-size: 16px; line-height: 1.6; margin: 0; }
    .brand ul { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 12px; color: #dfe3ff; }
    .brand li { display: flex; align-items: center; gap: 10px; }
    .brand li mat-icon { color: #a5b4ff; }
    .form-side { display: grid; place-items: center; padding: 32px 16px; position: relative; }
    .lang { position: absolute; top: 20px; right: 24px; }
    .form { width: 100%; max-width: 400px; padding: 32px; display: flex; flex-direction: column; }
    .form h2 { font-size: 24px; }
    .form > p { margin: 4px 0 20px; }
    .submit { height: 46px; font-size: 15px; margin-top: 4px; }
    .submit mat-spinner { margin: 0 auto; }
    .alert { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 10px; margin-bottom: 16px; font-size: 13px; }
    .alert.error { background: var(--k2-danger-soft); color: var(--k2-danger); }
    .alert.warn { background: var(--k2-warning-soft); color: var(--k2-warning); }
    @media (max-width: 900px) { .login { grid-template-columns: 1fr; } .brand { display: none; } }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  /** Guarda o erro (não o texto) para a mensagem acompanhar a troca de idioma. */
  readonly error = signal<unknown>(null);
  readonly showPassword = signal(false);
  readonly expired = signal(this.route.snapshot.queryParamMap.has('expired'));

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  errorText(): string {
    return apiErrorMessage(this.error(), 'auth.loginFailed');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl && returnUrl !== '/login' ? returnUrl : '/dashboard');
      },
      error: (e) => {
        this.loading.set(false);
        this.expired.set(false);
        this.error.set(e);
      },
    });
  }
}
