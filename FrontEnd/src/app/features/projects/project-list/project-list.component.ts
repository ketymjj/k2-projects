import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ProjectsApi } from '../../../core/services/api.services';
import { DataEventsService } from '../../../core/services/data-events.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ProjectStatusBadgeComponent } from '../../../shared/components/project-status-badge/project-status-badge.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PROJECT_STATUSES } from '../../../shared/models/labels';
import { PagedResult, ProjectListItem, ProjectStatus } from '../../../shared/models/models';
import { apiErrorMessage, formatDate } from '../../../shared/utils';
import { ProjectActionsService } from '../project-actions.service';

@Component({
  selector: 'k2-project-list',
  imports: [ReactiveFormsModule, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, MatProgressBarModule, TranslocoPipe, PageHeaderComponent,
    LoadingComponent, ErrorStateComponent, EmptyStateComponent, ProjectStatusBadgeComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
})
export class ProjectListComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(ProjectsApi);
  private readonly actions = inject(ProjectActionsService);
  private readonly router = inject(Router);

  readonly statuses = PROJECT_STATUSES;
  readonly columns = ['name', 'status', 'owner', 'progress', 'due', 'actions'];
  readonly search = new FormControl('', { nonNullable: true });
  readonly status = new FormControl<ProjectStatus | null>(null);
  readonly page = signal<PagedResult<ProjectListItem> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly fmt = formatDate;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.search.valueChanges.pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe(() => { this.pageIndex.set(0); this.load(); });
    this.status.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => { this.pageIndex.set(0); this.load(); });
    inject(DataEventsService).changes().pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.load());
    this.load();
  }

  errorText(): string {
    return apiErrorMessage(this.error(), 'errors.loadProjects');
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({ search: this.search.value, status: this.status.value ?? undefined, page: this.pageIndex() + 1, pageSize: this.pageSize() })
      .subscribe({
        next: (p) => { this.page.set(p); this.loading.set(false); },
        error: (e) => { this.loading.set(false); this.error.set(e); },
      });
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.load();
  }

  open(p: ProjectListItem): void { this.router.navigate(['/projects', p.id]); }
  openKanban(p: ProjectListItem): void { this.router.navigate(['/kanban'], { queryParams: { project: p.id } }); }

  async create(): Promise<void> {
    const created = await this.actions.openForm();
    if (created) this.router.navigate(['/projects', created.id]);
  }

  async edit(p: ProjectListItem): Promise<void> {
    if (await this.actions.openForm(p)) this.load();
  }

  async remove(p: ProjectListItem): Promise<void> {
    if (await this.actions.delete(p)) this.load();
  }
}
