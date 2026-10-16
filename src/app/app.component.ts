import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { Subscription } from 'rxjs';
import { AuthService } from './Core/auth/services/auth.service';
import { NotificationStore } from './Core/notifications/state/notification.store';
import { LoadingOverlayComponent } from './Core/Components/LoadingOverlay/loading-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Toast, LoadingOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'ContApp';

  private readonly authService = inject(AuthService);
  private readonly notificationStore = inject(NotificationStore);
  private userSubscription?: Subscription;

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe((user) => {
      console.log('[Notifications] currentUser$ emitted:', user);
      if (!user || !user.id) {
        this.notificationStore.destroy();
        return;
      }
      console.log('[Notifications] initForUser with sub =', user.id);
      this.notificationStore.initForUser(user.id);
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.notificationStore.destroy();
  }
}
