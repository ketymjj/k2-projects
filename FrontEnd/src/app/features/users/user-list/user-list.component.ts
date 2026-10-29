import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged, firstValueFrom, merge } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { t } from '../../../core/i18n/i18n-state';
import { UsersApi } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { RoleBadgeComponent } from '../../../shared/components/role-badge/role-badge.component';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { USER_ROLES } from '../../../shared/models/labels';
import { PagedResult, User, UserRole } from '../../../shared/models/models';
import { apiErrorMessage, formatDate } from '../../../shared/utils';
import { UserFormDialogComponent } from '../user-form-dialog/user-form-dialog.component';

@Component({
  selector: 'k2-user-list',
  imports: [ReactiveFormsModule, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatTooltipModule, MatProgressBarModule, TranslocoPipe, PageHeaderComponent, LoadingComponent, ErrorStateComponent,
    EmptyStateComponent, AvatarComponent, RoleBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(UsersApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly roles = USER_ROLES;
  readonly columns = ['name', 'role', 'status', 'created', 'actions'];
  readonly search = new FormControl('', { nonNullable: true });
  readonly role = new FormControl<UserRole | null>(null);
  readonly active = new FormControl<boolean | null>(null);
  readonly page = signal<PagedResult<User> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly fmt = formatDate;

  constructor() {
    merge(this.search.valueChanges.pipe(debounceTime(350), distinctUntilChanged()), this.role.valueChanges, this.active.valueChanges)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => { this.pageIndex.set(0); this.load(); });
    this.load();
  }

  errorText(): string {
    return apiErrorMessage(this.error(), 'errors.loadUsers');
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({
      search: this.search.value, role: this.role.value ?? undefined, active: this.active.value ?? undefined,
      page: this.pageIndex() + 1, pageSize: this.pageSize(),
    }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.error.set(e); },
    });
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.load();
  }

  async openForm(user: User | null = null): Promise<void> {
    const ref = this.dialog.open(UserFormDialogComponent, { data: user, width: '560px', maxWidth: '95vw', autoFocus: false });
    const saved = await firstValueFrom(ref.afterClosed());
    if (saved) {
      if (saved.id === this.auth.user()?.id) this.auth.updateUser(saved);
      this.load();
    }
  }

  async toggleActive(user: User): Promise<void> {
    const activate = !user.active;
    const ok = await this.confirm.ask({
      title: t(activate ? 'users.activateUser' : 'users.deactivateUser'),
      message: t(activate ? 'users.activateMessage' : 'users.deactivateMessage', { name: user.name }),
      confirmText: t(activate ? 'users.activate' : 'users.deactivate'),
      danger: !activate,
    });
    if (!ok) return;
    this.api.setActive(user.id, activate).subscribe({
      next: () => { this.toast.success(t(activate ? 'users.toast.activated' : 'users.toast.deactivated')); this.load(); },
      error: (e) => this.toast.error(e),
    });
  }
}
