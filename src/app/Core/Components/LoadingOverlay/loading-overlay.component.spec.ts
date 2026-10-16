import { Component } from '@angular/core';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  discardPeriodicTasks,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { LoadingOverlayComponent } from './loading-overlay.component';
import { LoadingService } from '../../Services/loading.service';

/** Réplica del cableado raíz de app.component.html: p-toast + overlay juntos. */
@Component({
  standalone: true,
  imports: [Toast, LoadingOverlayComponent],
  template: `<p-toast></p-toast><app-loading-overlay />`,
})
class ToastOverOverlayHostComponent {}

describe('LoadingOverlay y toasts (visibilidad de errores)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastOverOverlayHostComponent],
      providers: [
        MessageService,
        provideHttpClientTesting(),
        provideNoopAnimations(),
        providePrimeNG({}),
      ],
    });
  });

  it('renderiza los toasts por encima del overlay de carga (z-index)', fakeAsync(() => {
    const fixture = TestBed.createComponent(ToastOverOverlayHostComponent);
    const loading = TestBed.inject(LoadingService);
    const messages = TestBed.inject(MessageService);

    // Overlay visible: petición pendiente más allá del umbral de 200 ms.
    const requestId = loading.requestStarted();
    fixture.detectChanges();
    tick(200);
    fixture.detectChanges();

    // Un toast emitido con la operación aún en vuelo (parcial fallida).
    messages.add({
      severity: 'error',
      summary: 'Error',
      detail: 'falló una operación concurrente',
    });
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    const overlay = document.querySelector<HTMLElement>('.loading-overlay');
    const toast = document.querySelector<HTMLElement>('.p-toast');
    expect(overlay).withContext('el overlay de carga debería estar visible').toBeTruthy();
    expect(toast).withContext('el contenedor del toast debería existir').toBeTruthy();

    const toastZ = Number(getComputedStyle(toast!).zIndex);
    const overlayZ = Number(getComputedStyle(overlay!).zIndex);
    expect(toastZ)
      .withContext('el toast debe pintarse por encima del overlay para que el error sea visible')
      .toBeGreaterThan(overlayZ);

    loading.requestFinished(requestId);
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
