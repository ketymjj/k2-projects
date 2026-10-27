import { HttpErrorResponse } from '@angular/common/http';
import { currentLang, hasTranslation, t } from '../core/i18n/i18n-state';
import { AppNotification, IsoDate } from './models/models';

/** Converte um Date local para "yyyy-MM-dd" sem deslocamento de fuso. */
export function toIsoDate(date: Date | null | undefined): IsoDate | null {
  if (!date || isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Converte "yyyy-MM-dd" em Date local (meia-noite local). */
export function fromIsoDate(value: IsoDate | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date())!;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// ---------- Formatação conforme o idioma ativo (24/10/2026 em pt-BR, 10/24/2026 em en-US) ----------

export function formatDate(value: IsoDate | string | null | undefined): string {
  if (!value) return '—';
  const date = value.length <= 10 ? fromIsoDate(value)! : new Date(value);
  return date.toLocaleDateString(currentLang(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(currentLang(), { dateStyle: 'short', timeStyle: 'short' });
}

export function formatDateLong(value: string | Date): string {
  return new Date(value).toLocaleString(currentLang(), { dateStyle: 'full', timeStyle: 'short' });
}

export function formatNumber(value: number): string {
  return value.toLocaleString(currentLang());
}

/** Formata com opções do Intl no idioma ativo (nomes de meses e dias da semana). */
export function formatWith(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString(currentLang(), options);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function relativeDue(value: IsoDate | null): string {
  if (!value) return t('time.noDueDate');
  const diff = Math.round((fromIsoDate(value)!.getTime() - fromIsoDate(todayIso())!.getTime()) / 86_400_000);
  if (diff === 0) return t('time.dueToday');
  if (diff === 1) return t('time.dueTomorrow');
  if (diff === -1) return t('time.dueYesterday');
  if (diff < 0) return t('time.dueAgo', { count: -diff });
  return t('time.dueIn', { count: diff });
}

export function timeAgo(value: string): string {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return t('time.now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t(days === 1 ? 'time.dayAgo' : 'time.daysAgo', { count: days });
  return formatDate(value);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// ---------- Erros da API: traduzidos pelos códigos estáveis devolvidos no ProblemDetails ----------

function translateCode(code: string | null | undefined, args?: Record<string, unknown>): string | null {
  if (!code) return null;
  const key = `apiErrors.${code}`;
  return hasTranslation(key) ? t(key, args) : null;
}

const STATUS_KEYS: Record<number, string> = {
  400: 'errors.validation', 401: 'errors.unauthorized', 403: 'errors.forbidden', 404: 'errors.notFound', 409: 'errors.conflict',
};

/** Mensagem amigável, no idioma ativo, a partir de um erro da API. */
export function apiErrorMessage(error: unknown, fallbackKey = 'errors.generic'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return t('errors.network');
    const body = error.error;
    const byCode = translateCode(body?.code, body?.args);
    if (byCode && body?.code !== 'VALIDATION_FAILED') return byCode;
    if (body?.errorCodes && typeof body.errorCodes === 'object') {
      const firstCode = Object.values(body.errorCodes as Record<string, string[]>).flat()[0];
      const fieldMessage = translateCode(firstCode);
      if (fieldMessage) return fieldMessage;
    }
    if (byCode) return byCode;
    if (STATUS_KEYS[error.status]) return t(STATUS_KEYS[error.status]);
    if (error.status >= 500) return t('errors.unexpected');
  }
  return t(fallbackKey);
}

/** Erros de validação por campo, já traduzidos ({ campo: mensagem }). */
export function apiFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!(error instanceof HttpErrorResponse)) return result;
  const codes = (error.error?.errorCodes ?? {}) as Record<string, string[]>;
  const messages = (error.error?.errors ?? {}) as Record<string, string[]>;
  for (const field of new Set([...Object.keys(codes), ...Object.keys(messages)])) {
    if (field.startsWith('$')) continue;
    result[field] = translateCode(codes[field]?.[0]) ?? (currentLang() === 'pt-BR' ? messages[field]?.[0] : null) ?? t('errors.invalidField');
  }
  return result;
}

// ---------- Notificações: texto montado no idioma ativo a partir do tipo + parâmetros ----------

export function notificationText(n: AppNotification): { title: string; message: string } {
  const base = `notifications.types.${n.type}`;
  const a = n.args;
  if (!a) {
    // Notificações antigas, sem parâmetros: título traduzido pelo tipo; mensagem original em português ou genérica.
    return {
      title: t(`${base}.title`),
      message: currentLang() === 'pt-BR' ? n.message : t(`${base}.generic`),
    };
  }
  switch (n.type) {
    case 'AssigneeChanged': {
      const removed = a['variant'] === 'removed';
      return {
        title: t(`${base}.${removed ? 'titleRemoved' : 'title'}`),
        message: t(`${base}.${removed ? 'messageRemoved' : 'message'}`, { task: a['task'] }),
      };
    }
    case 'DueSoon':
      return {
        title: t(`${base}.title`),
        message: a['today'] === 'true'
          ? t(`${base}.messageToday`, { task: a['task'] })
          : t(`${base}.message`, { task: a['task'], date: formatDate(a['dueDate']) }),
      };
    case 'Overdue':
      return { title: t(`${base}.title`), message: t(`${base}.message`, { task: a['task'], date: formatDate(a['dueDate']) }) };
    default:
      return { title: t(`${base}.title`), message: t(`${base}.message`, a) };
  }
}
