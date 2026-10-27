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
import { AvatarComponent } from '../../shared/components/badges.component';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { LoadingComponent } from '../../shared/components/states.component';
import { TaskComment } from '../../shared/models/models';
import { formatDateLong, timeAgo } from '../../shared/utils';

/** Comentários da tarefa em formato de conversa. O conteúdo escrito pelos usuários nunca é traduzido. */
@Component({
  selector: 'k2-task-comments',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe,
    AvatarComponent, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="comments">
      <div class="title"><mat-icon>forum</mat-icon> {{ 'comments.title' | transloco }} <span class="muted">({{ comments().length }})</span></div>

      @if (loading()) {
        <k2-loading [message]="'comments.loading' | transloco" />
      } @else {
        <div class="thread" #thread>
          @for (c of comments(); track c.id) {
            <div class="msg" [class.mine]="c.isMine">
              <k2-avatar [name]="c.userName" [size]="30" />
              <div class="bubble">
                <div class="meta">
                  <strong>{{ c.userName }}</strong>
                  <span class="muted small" [matTooltip]="fullDate(c.createdAt)">{{ ago(c.createdAt) }}@if (c.updatedAt) { · {{ 'common.edited' | transloco }} }</span>
                </div>
                @if (editingId() === c.id) {
                  <mat-form-field class="w-100 edit">
                    <textarea matInput rows="2" [ngModel]="editText()" (ngModelChange)="editText.set($event)" maxlength="2000"></textarea>
                  </mat-form-field>
                  <div class="row edit-actions">
                    <button mat-button (click)="editingId.set(null)">{{ 'common.cancel' | transloco }}</button>
                    <button mat-flat-button (click)="saveEdit(c)" [disabled]="!editText().trim() || busy()">{{ 'common.save' | transloco }}</button>
                  </div>
                } @else {
                  <p>{{ c.content }}</p>
                  @if (c.isMine) {
                    <div class="actions">
                      <button mat-icon-button (click)="startEdit(c)" [matTooltip]="'comments.editTooltip' | transloco" [attr.aria-label]="'comments.editAria' | transloco"><mat-icon>edit</mat-icon></button>
                      <button mat-icon-button (click)="remove(c)" [matTooltip]="'comments.deleteTooltip' | transloco" [attr.aria-label]="'comments.deleteAria' | transloco"><mat-icon>delete</mat-icon></button>
                    </div>
                  }
                }
              </div>
            </div>
          } @empty {
            <p class="muted empty">{{ 'comments.empty' | transloco }}</p>
          }
        </div>
      }

      <div class="composer">
        <mat-form-field class="w-100">
          <mat-label>{{ 'comments.placeholder' | transloco }}</mat-label>
          <textarea matInput rows="2" [ngModel]="text()" (ngModelChange)="text.set($event)" maxlength="2000"
                    (keydown.control.enter)="send()"></textarea>
          <mat-hint>{{ 'comments.hint' | transloco }}</mat-hint>
        </mat-form-field>
        <button mat-flat-button class="btn-gradient" (click)="send()" [disabled]="!text().trim() || busy()">
          <mat-icon>send</mat-icon> {{ 'common.send' | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .title { display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 12px; }
    .thread { display: flex; flex-direction: column; gap: 12px; max-height: 320px; overflow-y: auto; padding: 4px 2px; }
    .msg { display: flex; gap: 10px; align-items: flex-start; }
    .msg.mine { flex-direction: row-reverse; }
    .bubble { background: var(--k2-surface-2); border: 1px solid var(--k2-border); border-radius: 4px 14px 14px 14px; padding: 8px 12px; max-width: 80%; position: relative; }
    .mine .bubble { background: var(--k2-primary-soft); border-color: transparent; border-radius: 14px 4px 14px 14px; }
    .meta { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .bubble p { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
    .actions { display: flex; justify-content: flex-end; margin: 0 -8px -6px 0; }
    .actions button { transform: scale(0.8); }
    .edit { margin-top: 6px; }
    .edit-actions { justify-content: flex-end; }
    .empty { text-align: center; padding: 12px; }
    .composer { display: flex; gap: 12px; align-items: flex-start; margin-top: 12px; }
    .composer button { margin-top: 8px; flex-shrink: 0; }
    @media (max-width: 560px) { .composer { flex-direction: column; align-items: stretch; } }
  `,
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
