import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AppNotification } from '../models/notification.model';

interface ApiResponse<T> {
  data: T;
  statusCode: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.API_URL}notifications`;

  list(
    userId: string,
    unreadOnly = false,
    limit = 50,
  ): Observable<ApiResponse<AppNotification[]>> {
    const params: Record<string, string | number | boolean> = { userId, limit };
    if (unreadOnly) params['unreadOnly'] = true;
    return this.http.get<ApiResponse<AppNotification[]>>(this.baseUrl, {
      params,
    });
  }

  unreadCount(userId: string): Observable<ApiResponse<number>> {
    return this.http.get<ApiResponse<number>>(`${this.baseUrl}/unread-count`, {
      params: { userId },
    });
  }

  markAsRead(notificationId: string, userId: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${notificationId}/read`, null, {
      params: { userId },
    });
  }

  markAllAsRead(userId: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/read-all`, null, {
      params: { userId },
    });
  }

  delete(notificationId: string, userId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${notificationId}`, {
      params: { userId },
    });
  }

  deleteAllRead(userId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/read-all`, {
      params: { userId },
    });
  }
}
