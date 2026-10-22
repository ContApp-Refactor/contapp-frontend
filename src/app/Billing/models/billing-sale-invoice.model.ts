// Modelos de la factura de venta. Todos los montos se guardan en CENTAVOS (enteros)
// para evitar errores de redondeo de punto flotante.
// Estos modelos sirven a facturas de venta Y de compra (ver `kind` y models/document-kind.ts).

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
  ivaPct: number;
}

// Contraparte del documento: cliente en ventas, proveedor en compras
export interface BillingClient {
  id: string;
  name: string;
  document: string;
}

export interface SaleInvoiceLine {
  productId: string;
  productName: string;
  cantidad: number;
  precioCatalogoCents: number; // solo lectura, referencia
  precioUnitarioCents: number; // editable: prevalece sobre el catálogo
  ivaCatalogoPct: number; // solo lectura, referencia (viene del producto)
  ivaPct: number; // editable: IVA efectivo, prevalece sobre el catálogo
}

export interface SaleInvoice {
  id: string;
  number: string | null; // null mientras sea borrador; se asigna al emitir
  status: InvoiceStatus;
  kind: DocumentKind; // los registros antiguos sin kind se normalizan a 'SALE' al leerlos
  // clientId/clientName = contraparte: cliente en ventas, proveedor en compras
  clientId: string | null;
  clientName: string | null;
  supplierInvoiceNumber?: string | null; // solo compras: N.º de la factura del proveedor (obligatorio al emitir)
  date: string; // yyyy-MM-dd
  lines: SaleInvoiceLine[];
  createdAt: string;
  updatedAt: string;
  emittedAt?: string;
  annulledAt?: string;
  annulReason?: string;
}

// Lo que el front envía al guardar un borrador (crea si no hay id)
export interface SaleInvoiceDraftInput {
  id?: string;
  kind: DocumentKind; // al actualizar prevalece el kind guardado
  clientId: string | null; // contraparte (cliente o proveedor)
  supplierInvoiceNumber?: string | null; // solo compras
  date: string;
  lines: SaleInvoiceLineInput[];
}

// Línea enviada por el front: solo valores efectivos; las referencias de catálogo
// (precioCatalogoCents, ivaCatalogoPct) las fija el mock/backend desde el producto.
export type SaleInvoiceLineInput = Omit<SaleInvoiceLine, 'precioCatalogoCents' | 'ivaCatalogoPct'>;

export interface InvoiceTotals {
  subtotalCents: number;
  ivaCents: number;
  totalCents: number;
}
