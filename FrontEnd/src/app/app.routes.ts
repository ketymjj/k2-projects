import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/guards';

// "title" guarda a chave de tradução; o TranslatedTitleStrategy monta o título da aba no idioma ativo.
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'routes.login',
    loadComponent: () => import('./core/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard', title: 'routes.dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'projects', title: 'routes.projects',
        loadComponent: () => import('./features/projects/project-list.component').then((m) => m.ProjectListComponent),
      },
      {
        path: 'projects/:id', title: 'routes.project',
        loadComponent: () => import('./features/projects/project-detail.component').then((m) => m.ProjectDetailComponent),
      },
      {
        path: 'my-tasks', title: 'routes.myTasks',
        loadComponent: () => import('./features/tasks/my-tasks.component').then((m) => m.MyTasksComponent),
      },
      {
        path: 'kanban', title: 'routes.kanban',
        loadComponent: () => import('./features/kanban/kanban.component').then((m) => m.KanbanComponent),
      },
      {
        path: 'calendar', title: 'routes.calendar',
        loadComponent: () => import('./features/calendar/calendar.component').then((m) => m.CalendarComponent),
      },
      {
        path: 'users', title: 'routes.users', canActivate: [roleGuard('Administrador')],
        loadComponent: () => import('./features/users/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'notifications', title: 'routes.notifications',
        loadComponent: () => import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent),
      },
      {
        path: 'settings', title: 'routes.settings',
        loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
