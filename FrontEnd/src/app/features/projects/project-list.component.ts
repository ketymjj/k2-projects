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
import { AuthService } from '../../core/auth/auth.service';
import { ProjectsApi } from '../../core/services/api.services';
import { DataEventsService } from '../../core/services/data-events.service';
import { AvatarComponent, ProjectStatusBadgeComponent } from '../../shared/components/badges.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/components/states.component';
import { PROJECT_STATUSES } from '../../shared/models/labels';
import { PagedResult, ProjectListItem, ProjectStatus } from '../../shared/models/models';
import { apiErrorMessage, formatDate } from '../../shared/utils';
import { ProjectActionsService } from './project-actions.service';

@Component({
  selector: 'k2-project-list',
  imports: [ReactiveFormsModule, MatTableModule, MatPaginatorModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, MatProgressBarModule, TranslocoPipe, PageHeaderComponent,
    LoadingComponent, ErrorStateComponent, EmptyStateComponent, ProjectStatusBadgeComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <k2-page-header [title]="'projects.title' | transloco" [subtitle]="'projects.subtitle' | transloco">
        @if (auth.canCreateProjects()) {
          <button mat-flat-button class="btn-gradient" (click)="create()"><mat-icon>add</mat-icon> {{ 'projects.new' | transloco }}</button>
        }
      </k2-page-header>

      <div class="card">
        <div class="toolbar card-pad filters">
          <mat-form-field class="search">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput [placeholder]="'projects.search' | transloco" [formControl]="search" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'common.status' | transloco }}</mat-label>
            <mat-select [formControl]="status">
              <mat-option [value]="null">{{ 'common.all' | transloco }}</mat-option>
              @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.labelKey | transloco }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        @if (loading() && page()) { <mat-progress-bar mode="indeterminate" /> }

        @if (loading() && !page()) {
          <k2-loading />
        } @else if (error()) {
          <k2-error [message]="errorText()" (retry)="load()" />
        } @else if (page()?.items?.length === 0) {
          <k2-empty icon="folder_open" [title]="'projects.emptyTitle' | transloco"
                    [message]="(search.value || status.value ? 'projects.emptyFiltered' : 'projects.emptyFirst') | transloco">
            @if (auth.canCreateProjects() && !search.value && !status.value) {
              <button mat-flat-button class="btn-gradient" (click)="create()"><mat-icon>add</mat-icon> {{ 'projects.new' | transloco }}</button>
            }
          </k2-empty>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="page()?.items ?? []">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>{{ 'projects.columns.project' | transloco }}</th>
                <td mat-cell *matCellDef="let p">
                  <div class="name"><strong>{{ p.name }}</strong><span class="muted small desc">{{ p.description }}</span></div>
                </td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>{{ 'projects.columns.status' | transloco }}</th>
                <td mat-cell *matCellDef="let p"><k2-project-status [status]="p.status" /></td>
              </ng-container>
              <ng-container matColumnDef="owner">
                <th mat-header-cell *matHeaderCellDef>{{ 'projects.columns.owner' | transloco }}</th>
                <td mat-cell *matCellDef="let p"><span class="owner"><k2-avatar [name]="p.ownerName" [size]="26" /> {{ p.ownerName }}</span></td>
              </ng-container>
              <ng-container matColumnDef="progress">
                <th mat-header-cell *matHeaderCellDef>{{ 'projects.columns.progress' | transloco }}</th>
                <td mat-cell *matCellDef="let p">
                  <div class="prog">
                    <div class="progress"><span [style.width.%]="p.progress"></span></div>
                    <span class="small"><strong>{{ p.progress }}%</strong> <span class="muted">· {{ p.completedTaskCount }}/{{ p.taskCount }}</span></span>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="due">
                <th mat-header-cell *matHeaderCellDef>{{ 'projects.columns.delivery' | transloco }}</th>
                <td mat-cell *matCellDef="let p">
                  {{ fmt(p.dueDate) }}
                  @if (p.overdueTaskCount) {
                    <div class="late small" [matTooltip]="'projects.overdueTooltip' | transloco"><mat-icon>alarm</mat-icon>{{ 'projects.overdueCount' | transloco: { count: p.overdueTaskCount } }}</div>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let p" (click)="$event.stopPropagation()">
                  <button mat-icon-button [matMenuTriggerFor]="menu" [attr.aria-label]="'projects.actions' | transloco"><mat-icon>more_vert</mat-icon></button>
                  <mat-menu #menu="matMenu" xPosition="before">
                    <button mat-menu-item (click)="open(p)"><mat-icon>visibility</mat-icon> {{ 'projects.viewDetails' | transloco }}</button>
                    <button mat-menu-item (click)="openKanban(p)"><mat-icon>view_kanban</mat-icon> {{ 'projects.openKanban' | transloco }}</button>
                    @if (p.canManage) {
                      <button mat-menu-item (click)="edit(p)"><mat-icon>edit</mat-icon> {{ 'common.edit' | transloco }}</button>
                      <button mat-menu-item (click)="remove(p)" class="danger"><mat-icon>delete</mat-icon> {{ 'common.delete' | transloco }}</button>
                    }
                  </mat-menu>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns" class="clickable" (click)="open(row)"></tr>
            </table>
          </div>
          <mat-paginator [length]="page()?.totalCount ?? 0" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
                         [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
        }
      </div>
    </div>
  `,
  styles: `
    .filters { padding-bottom: 0; margin-bottom: 0; }
    table { width: 100%; }
    .name { display: flex; flex-direction: column; padding: 10px 0; max-width: 380px; }
    .desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .owner { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
    .prog { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
    .late { color: var(--k2-danger); display: flex; align-items: center; gap: 2px; }
    .late mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .danger { color: var(--k2-danger); }
  `,
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
