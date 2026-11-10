import { ActivatedRoute } from '@angular/router';
import { DocumentKind } from '../models/document-kind';

/** Tipo de documento de la ruta (`data.kind`); sin dato se asume venta. */
export function kindFromRoute(route: ActivatedRoute | null): DocumentKind {
  return route?.snapshot?.data?.['kind'] === 'PURCHASE' ? 'PURCHASE' : 'SALE';
}
