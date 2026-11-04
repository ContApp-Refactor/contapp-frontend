import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, defer, switchMap, tap, throwError } from 'rxjs';

// Intento de creación en curso de un ámbito: su clave, el cuerpo ORIGINAL con el que se envió y si el resultado se
// desconoce (el último intento terminó sin respuesta HTTP definitiva: puede que el back sí haya creado el documento).
interface PendingCreation {
  key: string;
  body: unknown;
  fingerprint: string;
  unknown: boolean;
}

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

const newKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

// Sin respuesta HTTP definitiva (timeout, red caída, status 0) o 5xx sin cuerpo del back (sin `code`, p. ej. un
// 502/504 del proxy): el back pudo haber creado el documento igual, así que el resultado es DESCONOCIDO.
// Un 4xx, o un 5xx con el cuerpo de error del back, es un resultado definitivo.
export const isUnknownOutcome = (e: unknown): boolean =>
  !(e instanceof HttpErrorResponse) ||
  e.status === 0 ||
  (e.status >= 500 && !(e.error as { code?: string } | null)?.code);

// Guarda la clave de idempotencia del intento de creación en curso, por ámbito (p. ej. 'invoice:SALE').
// - Mismo ámbito + mismo cuerpo => misma clave (doble clic o reintento por red: el back devuelve el mismo documento).
// - Resultado DESCONOCIDO (el último intento no tuvo respuesta HTTP): el siguiente intento REENVÍA el cuerpo ORIGINAL con
//   la MISMA clave (el back hace replay y devuelve el mismo documento) y, ya con el documento y su `version`, el cuerpo
//   nuevo (si difiere) se aplica con un PUT. Así un timeout seguido de una edición no crea un segundo documento.
// - Resultado definitivo: éxito => se libera (`release`); error 4xx/5xx del back => se descarta (`discard`), y el
//   siguiente intento usa una clave nueva.
// - Cuerpo distinto sin resultado desconocido => otra intención => clave nueva (si no, el back respondería 409
//   BILLING_IDEMPOTENCY_CONFLICT).
@Injectable({ providedIn: 'root' })
export class IdempotencyKeyStore {
  private readonly pending = new Map<string, PendingCreation>();

  /** Clave (y cuerpo a enviar) del intento de creación; `replay` = se reenvía el cuerpo original y el nuevo difiere. */
  acquire(scope: string, body: unknown): { key: string; body: unknown; replay: boolean } {
    const fingerprint = JSON.stringify(body);
    const current = this.pending.get(scope);
    if (current && (current.unknown || current.fingerprint === fingerprint)) {
      return { key: current.key, body: current.body, replay: current.fingerprint !== fingerprint };
    }
    const created: PendingCreation = { key: newKey(), body, fingerprint, unknown: false };
    this.pending.set(scope, created);
    return { key: created.key, body, replay: false };
  }

  keyFor(scope: string, body: unknown): string {
    return this.acquire(scope, body).key;
  }

  /** El intento terminó sin respuesta HTTP: el resultado es desconocido (se reenviará con la misma clave y cuerpo). */
  markUnknown(scope: string, key: string): void {
    const current = this.pending.get(scope);
    if (current?.key === key) current.unknown = true;
  }

  /** Libera la clave pendiente del ámbito (creación exitosa). Solo si sigue siendo la misma clave. */
  release(scope: string, key: string): void {
    if (this.pending.get(scope)?.key === key) this.pending.delete(scope);
  }

  /** Error definitivo del back: la clave se descarta (el siguiente intento usa una nueva). */
  discard(scope: string, key: string): void {
    this.release(scope, key);
  }

  /** Olvida cualquier intento pendiente del ámbito (p. ej. se borró el documento que pudo crear el intento). */
  forget(scope: string): void {
    this.pending.delete(scope);
  }

  /**
   * Creación idempotente. `send` hace el POST con la clave y el cuerpo indicados; `reconcile` aplica el cuerpo nuevo sobre el
   * documento ya creado (PUT con su `version`) cuando se reenvió el cuerpo original por un resultado desconocido.
   * Si `reconcile` falla la clave se conserva: el siguiente guardado reenvía el original (replay) y reintenta el PUT.
   */
  create<T>(
    scope: string,
    body: unknown,
    send: (key: string, body: unknown) => Observable<T>,
    reconcile: (created: T) => Observable<T>,
  ): Observable<T> {
    return defer(() => {
      const { key, body: sent, replay } = this.acquire(scope, body);
      const created$ = send(key, sent).pipe(
        catchError((err: unknown) => {
          if (isUnknownOutcome(err)) this.markUnknown(scope, key);
          else this.discard(scope, key);
          return throwError(() => err);
        }),
      );
      if (!replay) return created$.pipe(tap(() => this.release(scope, key)));
      return created$.pipe(
        switchMap((created) => reconcile(created)),
        tap(() => this.release(scope, key)),
      );
    });
  }
}
