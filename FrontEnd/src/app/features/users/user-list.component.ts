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
import { AuthService } from '../../core/auth/auth.service';
import { t } from '../../core/i18n/i18n-state';
import { UsersApi } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent, RoleBadgeComponent } from '../../shared/components/badges.component';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/components/states.component';
import { USER_ROLES } from '../../shared/models/labels';
import { PagedResult, User, UserRole } from '../../shared/models/models';
import { apiErrorMessage, formatDate } from '../../shared/utils';
import { UserFormDialogComponent } from './user-form-dialog.component';

@Component({
  selector: 'k2-user-list',
  imports: [ReactiveFormsModule, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatTooltipModule, MatProgressBarModule, TranslocoPipe, PageHeaderComponent, LoadingComponent, ErrorStateComponent,
    EmptyStateComponent, AvatarComponent, RoleBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <k2-page-header [title]="'users.title' | transloco" [subtitle]="'users.subtitle' | transloco">
        <button mat-flat-button class="btn-gradient" (click)="openForm()"><mat-icon>person_add</mat-icon> {{ 'users.new' | transloco }}</button>
      </k2-page-header>

      <div class="card">
        <div class="toolbar card-pad filters">
          <mat-form-field class="search">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput [placeholder]="'users.search' | transloco" [formControl]="search" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'users.role' | transloco }}</mat-label>
            <mat-select [formControl]="role">
              <mat-option [value]="null">{{ 'common.all' | transloco }}</mat-option>
              @for (r of roles; track r.value) { <mat-option [value]="r.value">{{ r.labelKey | transloco }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'users.situation' | transloco }}</mat-label>
            <mat-select [formControl]="active">
              <mat-option [value]="null">{{ 'common.all' | transloco }}</mat-option>
              <mat-option [value]="true">{{ 'users.activeFilter' | transloco }}</mat-option>
              <mat-option [value]="false">{{ 'users.inactiveFilter' | transloco }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        @if (loading() && page()) { <mat-progress-bar mode="indeterminate" /> }

        @if (loading() && !page()) {
          <k2-loading />
        } @else if (error()) {
          <k2-error [message]="errorText()" (retry)="load()" />
        } @else if (page()?.items?.length === 0) {
          <k2-empty icon="group" [title]="'users.emptyTitle' | transloco" />
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="page()?.items ?? []">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>{{ 'users.columns.user' | transloco }}</th>
                <td mat-cell *matCellDef="let u">
                  <div class="user"><k2-avatar [name]="u.name" [size]="34" /><span><strong>{{ u.name }}</strong><span class="muted small">{{ u.email }}</span></span></div>
                </td>
              </ng-container>
              <ng-container matColumnDef="role">
                <th mat-header-cell *matHeaderCellDef>{{ 'users.columns.role' | transloco }}</th>
                <td mat-cell *matCellDef="let u"><k2-role [role]="u.role" /></td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>{{ 'users.columns.status' | transloco }}</th>
                <td mat-cell *matCellDef="let u">
                  <span class="badge" [class.on]="u.active" [class.off]="!u.active"><span class="dot"></span>{{ (u.active ? 'users.active' : 'users.inactive') | transloco }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="created">
                <th mat-header-cell *matHeaderCellDef>{{ 'users.columns.createdAt' | transloco }}</th>
                <td mat-cell *matCellDef="let u">{{ fmt(u.createdAt) }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let u" class="actions">
                  <button mat-icon-button (click)="openForm(u)" [matTooltip]="'common.edit' | transloco" [attr.aria-label]="'users.editUser' | transloco"><mat-icon>edit</mat-icon></button>
                  @if (u.id !== auth.user()?.id) {
                    <button mat-icon-button (click)="toggleActive(u)" [matTooltip]="(u.active ? 'users.deactivate' : 'users.activate') | transloco"
                            [attr.aria-label]="(u.active ? 'users.deactivateUser' : 'users.activateUser') | transloco">
                      <mat-icon>{{ u.active ? 'person_off' : 'person_check' }}</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </div>
          <mat-paginator [length]="page()?.totalCount ?? 0" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
        }
      </div>
    </div>
  `,
  styles: `
    .filters { padding-bottom: 0; margin-bottom: 0; }
    table { width: 100%; }
    .user { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .user > span { display: flex; flex-direction: column; }
    .badge.on { background: var(--k2-success-soft); color: var(--k2-success); }
    .badge.off { background: var(--k2-surface-2); color: var(--k2-text-muted); }
    .actions { text-align: right; white-space: nowrap; }
  `,
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
