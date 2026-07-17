import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
  private eventSource: EventSource | null = null;
  private currentUserId: string | null = null;
  private readonly notifications$ = new Subject<AppNotification>();

  readonly stream = this.notifications$.asObservable();

  connect(userId: string): void {
    if (this.eventSource && this.currentUserId === userId) {
      return;
    }
    this.disconnect();

    const url = `${environment.API_URL}notifications/stream?userId=${encodeURIComponent(userId)}`;
    console.log('[Notifications] opening SSE ->', url);
    const es = new EventSource(url, { withCredentials: false });
    this.eventSource = es;
    this.currentUserId = userId;

    es.addEventListener('notification', (ev: MessageEvent) => {
      console.log('[Notifications] event received:', ev.data);
      try {
        this.notifications$.next(JSON.parse(ev.data) as AppNotification);
      } catch (err) {
        console.warn('[Notifications] malformed payload', err);
      }
    });

    es.addEventListener('connected', () => {
      console.log('[Notifications] SSE handshake OK');
    });

    es.onerror = (err) => {
      console.warn(
        '[Notifications] SSE error',
        err,
        'readyState =',
        es.readyState,
      );
    };
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.currentUserId = null;
  }
}
