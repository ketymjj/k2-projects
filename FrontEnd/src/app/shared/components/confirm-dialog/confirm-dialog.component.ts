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
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
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
