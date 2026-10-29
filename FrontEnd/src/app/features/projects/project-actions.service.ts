import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { t } from '../../core/i18n/i18n-state';
import { ProjectsApi } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ProjectListItem } from '../../shared/models/models';
import { ProjectFormDialogComponent } from './project-form-dialog/project-form-dialog.component';

@Injectable({ providedIn: 'root' })
export class ProjectActionsService {
  private readonly dialog = inject(MatDialog);
  private readonly api = inject(ProjectsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  openForm(project: ProjectListItem | null = null): Promise<ProjectListItem | undefined> {
    const ref = this.dialog.open(ProjectFormDialogComponent, { data: project, width: '640px', maxWidth: '95vw', autoFocus: false });
    return firstValueFrom(ref.afterClosed());
  }

  /**
   * Exclusão em duas etapas: projetos sem tarefas pedem confirmação simples; projetos com tarefas
   * exigem que o usuário digite o nome do projeto (confirmação explícita).
   */
  async delete(project: ProjectListItem): Promise<boolean> {
    if (project.taskCount > 0) {
      const ok = await this.confirm.ask({
        title: t('projects.delete.withTasksTitle'),
        message: t('projects.delete.withTasksMessage', { name: project.name, count: project.taskCount }),
        confirmText: t('projects.delete.confirmPermanent'),
        danger: true,
        typeToConfirm: project.name,
      });
      return ok ? this.run(project, true) : false;
    }
    const ok = await this.confirm.ask({
      title: t('projects.delete.title'),
      message: t('projects.delete.message', { name: project.name }),
      confirmText: t('common.delete'),
      danger: true,
    });
    return ok ? this.run(project, false) : false;
  }

  private async run(project: ProjectListItem, confirm: boolean): Promise<boolean> {
    try {
      await firstValueFrom(this.api.delete(project.id, confirm));
      this.toast.success(t('projects.toast.deleted'));
      return true;
    } catch (e) {
      // Tarefas podem ter sido criadas enquanto o diálogo estava aberto: pede a confirmação explícita.
      if (e instanceof HttpErrorResponse && e.status === 409 && !confirm) {
        return this.delete({ ...project, taskCount: e.error?.details?.taskCount ?? 1 });
      }
      this.toast.error(e);
      return false;
    }
  }
}
