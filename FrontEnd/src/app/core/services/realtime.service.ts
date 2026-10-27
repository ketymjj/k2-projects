import { inject, Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../../shared/models/models';
import { AuthService } from '../auth/auth.service';
import { DataChange, DataEventsService } from './data-events.service';

/** Conexão SignalR para notificações e atualizações em tempo real. */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly events = inject(DataEventsService);
  private connection?: HubConnection;

  readonly notification$ = new Subject<AppNotification>();
  readonly connected = signal(false);

  async connect(): Promise<void> {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) return;

    this.connection = new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/notifications`, { accessTokenFactory: () => this.auth.token() ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.on('notification', (n: AppNotification) => this.notification$.next(n));
    this.connection.on('dataChanged', (change: DataChange) => this.events.emit(change.entity, change.projectId));
    this.connection.onreconnected(() => this.connected.set(true));
    this.connection.onreconnecting(() => this.connected.set(false));
    this.connection.onclose(() => this.connected.set(false));

    try {
      await this.connection.start();
      this.connected.set(true);
    } catch {
      // A aplicação continua funcionando sem tempo real; o SignalR tentará novamente na próxima navegação.
      this.connected.set(false);
    }
  }

  async disconnect(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    this.connected.set(false);
    if (connection) await connection.stop().catch(() => undefined);
  }
}
