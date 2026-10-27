import { ChangeDetectionStrategy, Component, computed, inject, Injectable, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

/** Textos já traduzidos por quem abre o diálogo. */
export interface ConfirmData {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  /** Exige que o usuário digite este texto para confirmar (confirmação explícita). */
  typeToConfirm?: string;
}

@Component({
  selector: 'k2-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, FormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="title">
      <mat-icon [class.danger]="data.danger">{{ data.danger ? 'warning' : 'help' }}</mat-icon>
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p class="message">{{ data.message }}</p>
      @if (data.typeToConfirm) {
        <p class="hint">{{ 'confirm.typeToConfirm' | transloco }} <strong>{{ data.typeToConfirm }}</strong>:</p>
        <mat-form-field appearance="outline" class="w-100">
          <input matInput [ngModel]="typed()" (ngModelChange)="typed.set($event)" autocomplete="off" cdkFocusInitial />
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button [mat-dialog-close]="false">{{ 'common.cancel' | transloco }}</button>
      <button mat-flat-button [class.btn-danger]="data.danger" [disabled]="!canConfirm()" [mat-dialog-close]="true">
        {{ data.confirmText ?? ('confirm.default' | transloco) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .title { display: flex; align-items: center; gap: 10px; }
    .title mat-icon { color: var(--k2-primary); }
    .title mat-icon.danger { color: var(--k2-danger); }
    .message { white-space: pre-line; color: var(--k2-text-2); margin-top: 0; }
    .hint { margin-bottom: 8px; }
    .btn-danger:not(:disabled) { background: var(--k2-danger) !important; color: #fff !important; }
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
  readonly typed = signal('');
  readonly canConfirm = computed(() => !this.data.typeToConfirm || this.typed().trim() === this.data.typeToConfirm);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  ask(data: ConfirmData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, { data, width: '440px', maxWidth: '95vw', autoFocus: false });
    return firstValueFrom(ref.afterClosed()).then((r) => r === true);
  }
}
