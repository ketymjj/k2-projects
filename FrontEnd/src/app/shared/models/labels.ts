import { NotificationType, ProjectStatus, TaskPriority, TaskStatus, UserRole } from './models';

/**
 * Opções de enums exibidas na interface. "value" é o valor interno (persistido/enviado à API, nunca traduzido);
 * "labelKey" é a chave de tradução do rótulo exibido.
 */
export interface Option<T extends string> {
  value: T;
  labelKey: string;
  color: string;
  icon?: string;
}

export const TASK_STATUSES: Option<TaskStatus>[] = [
  { value: 'AFazer', labelKey: 'enums.taskStatus.AFazer', color: 'var(--k2-status-todo)', icon: 'radio_button_unchecked' },
  { value: 'EmAndamento', labelKey: 'enums.taskStatus.EmAndamento', color: 'var(--k2-status-doing)', icon: 'timelapse' },
  { value: 'Concluido', labelKey: 'enums.taskStatus.Concluido', color: 'var(--k2-status-done)', icon: 'check_circle' },
];

export const TASK_PRIORITIES: Option<TaskPriority>[] = [
  { value: 'Baixa', labelKey: 'enums.priority.Baixa', color: 'var(--k2-prio-low)', icon: 'keyboard_double_arrow_down' },
  { value: 'Media', labelKey: 'enums.priority.Media', color: 'var(--k2-prio-medium)', icon: 'drag_handle' },
  { value: 'Alta', labelKey: 'enums.priority.Alta', color: 'var(--k2-prio-high)', icon: 'keyboard_arrow_up' },
  { value: 'Urgente', labelKey: 'enums.priority.Urgente', color: 'var(--k2-prio-urgent)', icon: 'priority_high' },
];

export const PROJECT_STATUSES: Option<ProjectStatus>[] = [
  { value: 'Planejado', labelKey: 'enums.projectStatus.Planejado', color: '#7c4dff', icon: 'event_note' },
  { value: 'EmAndamento', labelKey: 'enums.projectStatus.EmAndamento', color: '#2a78d6', icon: 'play_circle' },
  { value: 'Concluido', labelKey: 'enums.projectStatus.Concluido', color: '#138a5b', icon: 'task_alt' },
  { value: 'Cancelado', labelKey: 'enums.projectStatus.Cancelado', color: '#7a8099', icon: 'cancel' },
];

export const USER_ROLES: Option<UserRole>[] = [
  { value: 'Administrador', labelKey: 'enums.role.Administrador', color: '#7c4dff', icon: 'shield_person' },
  { value: 'Gerente', labelKey: 'enums.role.Gerente', color: '#2a78d6', icon: 'manage_accounts' },
  { value: 'Colaborador', labelKey: 'enums.role.Colaborador', color: '#138a5b', icon: 'person' },
];

export const NOTIFICATION_ICONS: Record<NotificationType, { icon: string; color: string }> = {
  TaskAssigned: { icon: 'assignment_ind', color: '#3657f5' },
  AssigneeChanged: { icon: 'swap_horiz', color: '#7c4dff' },
  DueSoon: { icon: 'schedule', color: '#b7791f' },
  Overdue: { icon: 'alarm', color: '#d62f45' },
  NewComment: { icon: 'chat', color: '#138a5b' },
};

export function optionOf<T extends string>(options: Option<T>[], value: T | null | undefined): Option<T> | undefined {
  return options.find((o) => o.value === value);
}
