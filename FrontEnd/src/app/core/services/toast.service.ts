import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { apiErrorMessage } from '../../shared/utils';
import { t } from '../i18n/i18n-state';

/** Mensagens de feedback. Os textos recebidos já devem estar traduzidos. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3500, panelClass: 'toast-success' });
  }

  /** Aceita um texto já traduzido ou um erro da API; "fallbackKey" é a chave usada se o erro não tiver código conhecido. */
  error(messageOrError: unknown, fallbackKey?: string): void {
    const message = typeof messageOrError === 'string' ? messageOrError : apiErrorMessage(messageOrError, fallbackKey);
    this.snackBar.open(message, t('common.close'), { duration: 6000, panelClass: 'toast-error' });
  }

  info(message: string, action = 'OK'): ReturnType<MatSnackBar['open']> {
    return this.snackBar.open(message, action, { duration: 6000, panelClass: 'toast-info' });
  }
}
