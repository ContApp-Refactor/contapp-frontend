import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LoadingService } from '../../Services/loading.service';

/**
 * Overlay global de carga: se monta una sola vez en app.component.html y
 * cubre toda la UI mientras hay peticiones HTTP en vuelo. Bloquea el puntero
 * (no se puede clickear nada por debajo), evitando envíos duplicados.
 */
@Component({
  selector: 'app-loading-overlay',
  imports: [AsyncPipe],
  templateUrl: './loading-overlay.component.html',
  styleUrl: './loading-overlay.component.css',
})
export class LoadingOverlayComponent {
  private readonly loadingService = inject(LoadingService);

  readonly visible$: Observable<boolean> = this.loadingService.visible$;
}
