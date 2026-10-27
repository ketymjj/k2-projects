import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, User } from '../../shared/models/models';

interface Session {
  token: string;
  expiresAt: string;
  user: User;
}

const STORAGE_KEY = 'k2.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(this.restore());
  private expiryTimer?: ReturnType<typeof setTimeout>;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'Administrador');
  readonly canCreateProjects = computed(() => this.role() === 'Administrador' || this.role() === 'Gerente');

  constructor() {
    this.scheduleExpiry();
  }

  login(email: string, password: string): Observable<void> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/login`, { email, password }).pipe(
      tap((res) => this.setSession({ token: res.token, expiresAt: res.expiresAt, user: res.user })),
      map(() => void 0),
    );
  }

  logout(): void {
    const token = this.token();
    if (token) {
      // JWT é stateless: o servidor apenas registra; a sessão é descartada no cliente.
      this.http.post(`${environment.apiUrl}/api/auth/logout`, {}).subscribe({ error: () => undefined });
    }
    this.clear();
    this.router.navigate(['/login']);
  }

  /** Chamado quando a API responde 401 ou o token expira. */
  expireSession(): void {
    if (!this.session()) return;
    this.clear();
    this.router.navigate(['/login'], { queryParams: { expired: 1, returnUrl: this.router.url } });
  }

  updateUser(user: User): void {
    const current = this.session();
    if (current) this.setSession({ ...current, user });
  }

  private setSession(session: Session): void {
    this.session.set(session);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* armazenamento indisponível */ }
    this.scheduleExpiry();
  }

  private clear(): void {
    clearTimeout(this.expiryTimer);
    this.session.set(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* armazenamento indisponível */ }
  }

  private restore(): Session | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as Session;
      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const session = this.session();
    if (!session) return;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    // setTimeout aceita no máximo ~24,8 dias
    this.expiryTimer = setTimeout(() => this.expireSession(), Math.min(Math.max(ms, 0), 2_000_000_000));
  }
}
