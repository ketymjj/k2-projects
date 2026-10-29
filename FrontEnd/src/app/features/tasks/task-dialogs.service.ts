import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TaskItem } from '../../shared/models/models';
import { TaskDetailDialogComponent } from './task-detail-dialog/task-detail-dialog.component';
import { TaskFormData, TaskFormDialogComponent } from './task-form-dialog/task-form-dialog.component';

/** Abre os diálogos de tarefa a partir de qualquer tela (listas, Kanban, calendário, notificações). */
@Injectable({ providedIn: 'root' })
export class TaskDialogsService {
  private readonly dialog = inject(MatDialog);

  openDetail(taskId: string): Promise<unknown> {
    const ref = this.dialog.open(TaskDetailDialogComponent, {
      data: { taskId }, width: '960px', maxWidth: '96vw', autoFocus: false, panelClass: 'task-detail-panel',
    });
    return firstValueFrom(ref.afterClosed());
  }

  openForm(data: TaskFormData = {}): Promise<TaskItem | undefined> {
    const ref = this.dialog.open(TaskFormDialogComponent, { data, width: '680px', maxWidth: '95vw', autoFocus: false });
    return firstValueFrom(ref.afterClosed());
  }
}
