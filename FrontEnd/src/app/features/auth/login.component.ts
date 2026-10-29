import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector.component';
import { apiErrorMessage } from '../../shared/utils';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'k2-login',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    TranslocoPipe, LanguageSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
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
