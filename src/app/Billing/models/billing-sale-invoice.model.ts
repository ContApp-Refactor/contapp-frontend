// Modelos de la factura de venta. Todos los montos se guardan en CENTAVOS (enteros)
// para evitar errores de redondeo de punto flotante.
// Estos modelos sirven a facturas de venta Y de compra (ver `kind` y models/document-kind.ts).

import { InvoiceReturnState } from './billing-sale-return.model';
import { DocumentKind } from './document-kind';

export type InvoiceStatus = 'BORRADOR' | 'EMITIDA' | 'ANULADA';

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  ANULADA: 'Anulada',
};

export interface BillingProduct {
  id: string;
  code: string;
  name: string;
  priceCents: number; // precio de referencia: de venta (SALE) o costo (PURCHASE), según getProducts(kind)
  ivaPct: number | null; // solo VISTA PREVIA del IVA de la categoría; null = sin dato (el back lo resuelve al guardar)
}

// Emisor congelado por el back al emitir (RN-06); null en borrador
export interface BillingIssuer {
  enterpriseId: string;
  name: string;
  nit: string;
  dv?: string | null;
  active: boolean;
}

// Contraparte del documento: cliente en ventas, proveedor en compras
export interface BillingClient {
  id: string;
  name: string;
  document: string;
  category?: string; // categoría (tipo) del tercero: "Cliente", "Proveedor", "Cliente/Proveedor"...
}

export interface SaleInvoiceLine {
  lineNo?: number; // posición de la línea en la factura (la asigna el back); las devoluciones la referencian
  productId: string;
  productName: string;
  cantidad: number;
  precioCatalogoCents: number; // solo lectura, referencia
  precioUnitarioCents: number; // editable: prevalece sobre el catálogo
  ivaCatalogoPct: number | null; // solo lectura, referencia que resuelve el back (null = sin dato aún, línea nueva sin guardar)
  ivaPct: number | null; // editable: IVA efectivo, prevalece sobre el catálogo (null = sin dato: el back lo resuelve al guardar)
  precioEditado?: boolean; // del back: true si el precio es un override del usuario (false = sigue al catálogo)
  ivaEditado?: boolean; // del back: true si el IVA es un override del usuario (false = sigue al catálogo)
  subtotalCents?: number; // del back: subtotal de la línea; en documentos no editables manda sobre el cálculo local
}

export interface SaleInvoice {
  id: string;
  number: string | null; // null mientras sea borrador; se asigna al emitir
  status: InvoiceStatus;
  kind: DocumentKind; // los registros antiguos sin kind se normalizan a 'SALE' al leerlos
  // clientId/clientName = contraparte: cliente en ventas, proveedor en compras
  clientId: string | null;
  clientName: string | null; // en documentos emitidos el back lo devuelve congelado
  clientDocument?: string | null; // documento de la contraparte (congelado en documentos emitidos)
  supplierInvoiceNumber?: string | null; // solo compras: N.º de la factura del proveedor (obligatorio al emitir)
  date: string; // yyyy-MM-dd
  lines: SaleInvoiceLine[];
  totals?: InvoiceTotals | null; // calculados por el back: en documentos no editables mandan sobre el cálculo local
  returnStatus?: InvoiceReturnState | null; // derivado por el back (SIN_DEVOLUCION / PARCIAL / TOTAL)
  createdAt: string;
  updatedAt: string;
  emittedAt?: string;
  annulledAt?: string;
  annulReason?: string;
  version?: number | null; // bloqueo optimista: se devuelve en cada respuesta y se reenvía al modificar
  issuer?: BillingIssuer | null; // emisor congelado al emitir; null en borrador
}

// Lo que el front envía al guardar un borrador (crea si no hay id)
export interface SaleInvoiceDraftInput {
  id?: string;
  kind: DocumentKind; // al actualizar prevalece el kind guardado
  clientId: string | null; // contraparte (cliente o proveedor)
  supplierInvoiceNumber?: string | null; // solo compras
  date: string;
  lines: SaleInvoiceLineInput[];
  version?: number | null; // versión conocida del borrador (bloqueo optimista); sin ella el back no verifica
}

// Línea enviada por el front: valores efectivos; las referencias de catálogo
// (precioCatalogoCents, ivaCatalogoPct) las fija el mock/backend desde el producto.
// Si llegan (opcionales), el adaptador HTTP las usa para detectar el precio SIN editar
// (igual a la referencia) y enviarlo como null: así el back lo sigue al catálogo.
export type SaleInvoiceLineInput = Omit<SaleInvoiceLine, 'precioCatalogoCents' | 'ivaCatalogoPct'> &
  Partial<Pick<SaleInvoiceLine, 'precioCatalogoCents' | 'ivaCatalogoPct'>>;

export interface InvoiceTotals {
  subtotalCents: number;
  ivaCents: number;
  totalCents: number;
}
