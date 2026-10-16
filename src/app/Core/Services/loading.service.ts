import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  timer,
} from 'rxjs';

/**
 * Cuenta las peticiones HTTP en vuelo y expone si el overlay global de carga
 * debe estar visible. El overlay aparece tras un umbral corto (200 ms) para no
 * parpadear en peticiones rápidas, y se oculta de inmediato al terminar todas.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending$ = new BehaviorSubject<number>(0);

  readonly visible$: Observable<boolean> = this.pending$.pipe(
    map((count) => count > 0),
    distinctUntilChanged(),
    switchMap((active) =>
      active ? timer(200).pipe(map(() => true)) : of(false),
    ),
  );

  requestStarted(): void {
    this.pending$.next(this.pending$.value + 1);
  }

  requestFinished(): void {
    this.pending$.next(Math.max(0, this.pending$.value - 1));
  }
}
