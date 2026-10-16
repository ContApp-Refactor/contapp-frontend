import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  distinctUntilChanged,
  interval,
  map,
  of,
  startWith,
  switchMap,
  timer,
} from 'rxjs';

/**
 * Cuenta las peticiones HTTP en vuelo y expone si el overlay global de carga
 * debe estar visible. El overlay aparece tras un umbral corto (200 ms) para no
 * parpadear en peticiones rápidas, y se oculta de inmediato al terminar todas.
 *
 * Tope de duración: una petición nunca settleada (conexión trabada) no puede
 * dejar el overlay cubriendo la UI para siempre ni retener su registro. El
 * overlay se oculta cuando ninguna petición pendiente tiene menos de
 * MAX_VISIBLE_AGE_MS de antigüedad (la UI "falla abierta") y su entrada se
 * poda del mapa, por lo que la memoria queda acotada aunque una petición
 * jamás termine.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  /** Antigüedad máxima (ms) de una petición que mantiene el overlay visible. */
  private static readonly MAX_VISIBLE_AGE_MS = 30_000;

  private sequence = 0;
  private readonly starts = new Map<number, number>();
  private readonly pending$ = new BehaviorSubject<number>(0);

  readonly visible$: Observable<boolean> = this.pending$.pipe(
    map((count) => count > 0),
    switchMap((active) => {
      if (!active) {
        return of(false);
      }
      return timer(200).pipe(
        map(() => this.hasYoungRequest()),
        switchMap((young) => {
          if (!young) {
            return of(false);
          }
          // Revisa cada segundo: si todas las pendientes superaron el tope,
          // emite false y el overlay desaparece aunque sigan en vuelo.
          return interval(1000).pipe(
            startWith(0),
            map(() => this.hasYoungRequest()),
            distinctUntilChanged(),
          );
        }),
      );
    }),
  );

  requestStarted(): number {
    const id = ++this.sequence;
    this.starts.set(id, Date.now());
    this.pending$.next(this.starts.size);
    return id;
  }

  requestFinished(id: number): void {
    this.starts.delete(id);
    this.pending$.next(this.starts.size);
  }

  private hasYoungRequest(): boolean {
    const now = Date.now();
    let pruned = false;
    for (const [id, startedAt] of this.starts) {
      if (now - startedAt >= LoadingService.MAX_VISIBLE_AGE_MS) {
        // Poda: una petición colgada no retiene su entrada para siempre.
        this.starts.delete(id);
        pruned = true;
      }
    }
    if (pruned && this.starts.size === 0) {
      this.pending$.next(0);
    }
    return this.starts.size > 0;
  }
}
