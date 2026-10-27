import { Injectable } from '@angular/core';
import { Observable, Subject, debounceTime } from 'rxjs';

export interface DataChange {
  entity: 'project' | 'task' | 'comment' | string;
  projectId?: string | null;
}

/**
 * Barramento de alterações de dados. Recebe eventos das próprias ações do usuário e do SignalR
 * (alterações feitas por outros usuários), para que Dashboard, listagens e Kanban se atualizem.
 */
@Injectable({ providedIn: 'root' })
export class DataEventsService {
  private readonly subject = new Subject<DataChange>();

  emit(entity: DataChange['entity'], projectId?: string | null): void {
    this.subject.next({ entity, projectId });
  }

  /** Alterações agrupadas para evitar recargas em sequência. */
  changes(debounceMs = 400): Observable<DataChange> {
    return this.subject.pipe(debounceTime(debounceMs));
  }
}
