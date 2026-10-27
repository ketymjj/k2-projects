import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AppNotification, Dashboard, MyTasks, PagedResult, ProjectDetail, ProjectListItem, ProjectLookup,
  ProjectMember, ProjectRequest, ProjectStatus, TaskComment, TaskDetail, TaskItem, TaskQuery, TaskRequest,
  TaskStatus, User, UserLookup, UserRole,
} from '../../shared/models/models';
import { DataEventsService } from './data-events.service';

const API = `${environment.apiUrl}/api`;

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class ProjectsApi {
  private readonly http = inject(HttpClient);
  private readonly events = inject(DataEventsService);

  list(query: { search?: string; status?: ProjectStatus; page?: number; pageSize?: number }) {
    return this.http.get<PagedResult<ProjectListItem>>(`${API}/projects`, { params: toParams(query) });
  }
  lookup() { return this.http.get<ProjectLookup[]>(`${API}/projects/lookup`); }
  get(id: string) { return this.http.get<ProjectDetail>(`${API}/projects/${id}`); }
  board(id: string) { return this.http.get<TaskItem[]>(`${API}/projects/${id}/board`); }

  create(body: ProjectRequest) {
    return this.http.post<ProjectListItem>(`${API}/projects`, body).pipe(tap((p) => this.events.emit('project', p.id)));
  }
  update(id: string, body: ProjectRequest) {
    return this.http.put<ProjectListItem>(`${API}/projects/${id}`, body).pipe(tap(() => this.events.emit('project', id)));
  }
  delete(id: string, confirm: boolean) {
    return this.http.delete<void>(`${API}/projects/${id}`, { params: toParams({ confirm }) })
      .pipe(tap(() => this.events.emit('project', id)));
  }
  addMember(id: string, userId: string) {
    return this.http.post<ProjectMember[]>(`${API}/projects/${id}/members`, { userId }).pipe(tap(() => this.events.emit('project', id)));
  }
  removeMember(id: string, userId: string) {
    return this.http.delete<void>(`${API}/projects/${id}/members/${userId}`).pipe(tap(() => this.events.emit('project', id)));
  }
}

@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly http = inject(HttpClient);
  private readonly events = inject(DataEventsService);

  list(query: TaskQuery) { return this.http.get<PagedResult<TaskItem>>(`${API}/tasks`, { params: toParams(query) }); }
  my() { return this.http.get<MyTasks>(`${API}/tasks/my`); }
  get(id: string) { return this.http.get<TaskDetail>(`${API}/tasks/${id}`); }

  create(body: TaskRequest) {
    return this.http.post<TaskItem>(`${API}/tasks`, body).pipe(tap((t) => this.events.emit('task', t.projectId)));
  }
  update(id: string, body: TaskRequest) {
    return this.http.put<TaskItem>(`${API}/tasks/${id}`, body).pipe(tap((t) => this.events.emit('task', t.projectId)));
  }
  changeStatus(id: string, status: TaskStatus) {
    return this.http.patch<TaskItem>(`${API}/tasks/${id}/status`, { status }).pipe(tap((t) => this.events.emit('task', t.projectId)));
  }
  move(id: string, status: TaskStatus, position: number): Observable<TaskItem> {
    return this.http.patch<TaskItem>(`${API}/tasks/${id}/move`, { status, position }).pipe(tap((t) => this.events.emit('task', t.projectId)));
  }
  delete(id: string, projectId: string) {
    return this.http.delete<void>(`${API}/tasks/${id}`).pipe(tap(() => this.events.emit('task', projectId)));
  }

  comments(taskId: string) { return this.http.get<TaskComment[]>(`${API}/tasks/${taskId}/comments`); }
  addComment(taskId: string, content: string) {
    return this.http.post<TaskComment>(`${API}/tasks/${taskId}/comments`, { content }).pipe(tap(() => this.events.emit('comment')));
  }
  updateComment(id: string, content: string) { return this.http.put<TaskComment>(`${API}/comments/${id}`, { content }); }
  deleteComment(id: string) { return this.http.delete<void>(`${API}/comments/${id}`).pipe(tap(() => this.events.emit('comment'))); }
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  list(query: { search?: string; role?: UserRole; active?: boolean; page?: number; pageSize?: number }) {
    return this.http.get<PagedResult<User>>(`${API}/users`, { params: toParams(query) });
  }
  lookup() { return this.http.get<UserLookup[]>(`${API}/users/lookup`); }
  create(body: { name: string; email: string; password: string; role: UserRole }) { return this.http.post<User>(`${API}/users`, body); }
  update(id: string, body: { name: string; email: string; role: UserRole; active: boolean; newPassword: string | null }) {
    return this.http.put<User>(`${API}/users/${id}`, body);
  }
  setActive(id: string, active: boolean) { return this.http.patch<User>(`${API}/users/${id}/active`, { active }); }
}

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);
  get() { return this.http.get<User>(`${API}/profile`); }
  update(body: { name: string; email: string }) { return this.http.put<User>(`${API}/profile`, body); }
  changePassword(body: { currentPassword: string; newPassword: string }) { return this.http.post<void>(`${API}/profile/password`, body); }
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  get() { return this.http.get<Dashboard>(`${API}/dashboard`); }
}

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);
  list(query: { onlyUnread?: boolean; page?: number; pageSize?: number }) {
    return this.http.get<PagedResult<AppNotification>>(`${API}/notifications`, { params: toParams(query) });
  }
  unreadCount() { return this.http.get<{ count: number }>(`${API}/notifications/unread-count`); }
  markRead(id: string) { return this.http.patch<void>(`${API}/notifications/${id}/read`, {}); }
  markAllRead() { return this.http.patch<{ updated: number }>(`${API}/notifications/read-all`, {}); }
}
