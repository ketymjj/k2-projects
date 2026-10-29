import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { t } from '../../core/i18n/i18n-state';
import { TasksApi } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { TaskComment } from '../../shared/models/models';
import { formatDateLong, timeAgo } from '../../shared/utils';

/** Comentários da tarefa em formato de conversa. O conteúdo escrito pelos usuários nunca é traduzido. */
@Component({
  selector: 'k2-task-comments',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe,
    AvatarComponent, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-comments.component.html',
  styleUrl: './task-comments.component.scss',
})
export class TaskCommentsComponent {
  readonly taskId = input.required<string>();
  private readonly api = inject(TasksApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  readonly comments = signal<TaskComment[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly text = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editText = signal('');
  readonly ago = timeAgo;
  readonly fullDate = formatDateLong;

  constructor() {
    effect(() => this.load(this.taskId()));
  }

  load(taskId: string): void {
    this.loading.set(true);
    this.api.comments(taskId).subscribe({
      next: (list) => { this.comments.set(list); this.loading.set(false); this.scrollToEnd(); },
      error: (e) => { this.loading.set(false); this.toast.error(e, 'errors.loadComments'); },
    });
  }

  send(): void {
    const content = this.text().trim();
    if (!content || this.busy()) return;
    this.busy.set(true);
    this.api.addComment(this.taskId(), content).subscribe({
      next: (c) => {
        this.comments.update((list) => [...list, c]);
        this.text.set('');
        this.busy.set(false);
        this.scrollToEnd();
      },
      error: (e) => { this.busy.set(false); this.toast.error(e); },
    });
  }

  startEdit(c: TaskComment): void {
    this.editingId.set(c.id);
    this.editText.set(c.content);
  }

  saveEdit(c: TaskComment): void {
    this.busy.set(true);
    this.api.updateComment(c.id, this.editText().trim()).subscribe({
      next: (updated) => {
        this.comments.update((list) => list.map((x) => (x.id === c.id ? updated : x)));
        this.editingId.set(null);
        this.busy.set(false);
        this.toast.success(t('comments.updated'));
      },
      error: (e) => { this.busy.set(false); this.toast.error(e); },
    });
  }

  async remove(c: TaskComment): Promise<void> {
    const ok = await this.confirm.ask({
      title: t('comments.deleteTitle'), message: t('comments.deleteMessage'), confirmText: t('common.delete'), danger: true,
    });
    if (!ok) return;
    this.api.deleteComment(c.id).subscribe({
      next: () => {
        this.comments.update((list) => list.filter((x) => x.id !== c.id));
        this.toast.success(t('comments.deleted'));
      },
      error: (e) => this.toast.error(e),
    });
  }

  private scrollToEnd(): void {
    setTimeout(() => {
      const el = this.thread()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
