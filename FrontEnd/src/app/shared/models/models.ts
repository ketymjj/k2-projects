export type UserRole = 'Administrador' | 'Gerente' | 'Colaborador';
export type ProjectStatus = 'Planejado' | 'EmAndamento' | 'Concluido' | 'Cancelado';
export type TaskStatus = 'AFazer' | 'EmAndamento' | 'Concluido';
export type TaskPriority = 'Baixa' | 'Media' | 'Alta' | 'Urgente';
export type NotificationType = 'TaskAssigned' | 'AssigneeChanged' | 'DueSoon' | 'Overdue' | 'NewComment';

/** Datas sem horário trafegam como "yyyy-MM-dd". */
export type IsoDate = string;

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface UserLookup {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  status: ProjectStatus;
  ownerId: string;
  ownerName: string;
  taskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  progress: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string | null;
  canManage: boolean;
}

export interface ProjectMember {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  addedAt: string;
  openTaskCount: number;
}

export interface ProjectDetail {
  project: ProjectListItem;
  todoCount: number;
  inProgressCount: number;
  members: ProjectMember[];
}

export interface ProjectLookup {
  id: string;
  name: string;
  status: ProjectStatus;
  canManage: boolean;
}

export interface ProjectRequest {
  name: string;
  description: string | null;
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  status: ProjectStatus;
  ownerId: string | null;
  memberIds?: string[];
}

export interface TaskItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: string | null;
  assignedToName: string | null;
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  parentTaskId: string | null;
  parentTaskTitle: string | null;
  subtaskCount: number;
  completedSubtaskCount: number;
  commentCount: number;
  isOverdue: boolean;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  canEdit: boolean;
  canChangeStatus: boolean;
}

export interface TaskDetail {
  task: TaskItem;
  description: string | null;
  createdById: string;
  createdByName: string;
  subtasks: TaskItem[];
}

export interface MyTasks {
  todo: TaskItem[];
  inProgress: TaskItem[];
  done: TaskItem[];
  overdue: TaskItem[];
}

export interface TaskRequest {
  projectId?: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: string | null;
  startDate: IsoDate | null;
  dueDate: IsoDate | null;
  parentTaskId: string | null;
}

export interface TaskQuery {
  projectId?: string;
  assignedToId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  dueFrom?: IsoDate;
  dueTo?: IsoDate;
  overdue?: boolean;
  parentTaskId?: string;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  isMine: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedTaskId: string | null;
  isRead: boolean;
  createdAt: string;
  /** Parâmetros do evento (task, project, author, dueDate...) para montar o texto no idioma ativo. */
  args: Record<string, string> | null;
}

export interface ChartItem {
  key: string;
  count: number;
}

export interface ProjectProgress {
  id: string;
  name: string;
  status: ProjectStatus;
  taskCount: number;
  completedTaskCount: number;
  progress: number;
}

export interface Dashboard {
  totalProjects: number;
  projectsInProgress: number;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  tasksByStatus: ChartItem[];
  tasksByPriority: ChartItem[];
  projectProgress: ProjectProgress[];
  myUpcomingTasks: TaskItem[];
  overdueTaskList: TaskItem[];
  recentProjects: ProjectListItem[];
}
