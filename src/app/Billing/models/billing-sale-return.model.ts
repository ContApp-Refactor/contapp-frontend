// Modelos de la devolución de venta. Una devolución es UN solo documento: también hace
// de nota crédito (NC-) en ventas o nota débito (DC-) en compras. Los montos se guardan en CENTAVOS (enteros).
// Estos modelos sirven a devoluciones de venta Y de compra (ver `kind`).

import { BillingIssuer, InvoiceStatus, InvoiceTotals } from './billing-sale-invoice.model';
import { DocumentKind } from './document-kind';

// Estado de devolución de una factura. Se CALCULA (ver utils/sale-return.ts), nunca se guarda.
export type InvoiceReturnState = 'SIN_DEVOLUCION' | 'PARCIAL' | 'TOTAL';

export interface SaleReturnLine {
  sourceLineNo?: number | null; // línea de la factura original que se devuelve (lineNo)
  productId: string;
  productName: string;
  cantidadVendida?: number; // snapshot de lo vendido (o comprado) en la factura original
  cantidadDevuelta: number;
  precioUnitarioCents: number; // congelado de la línea original
  ivaPct: number; // congelado de la línea original
  subtotalCents?: number; // del back: subtotal de la línea; en devoluciones no editables manda sobre el cálculo local
}

export interface SaleReturn {
  id: string;
  number: string | null; // null mientras sea borrador; se asigna al emitir (NC-000001... / DC-000001...)
  status: InvoiceStatus; // mismo ciclo de vida que la factura
  kind: DocumentKind; // igual al de la factura original; los registros antiguos se normalizan a 'SALE'
  invoiceId: string;
  originalNumber: string | null; // snapshot del número de la factura original
  originalDate: string; // yyyy-MM-dd de la factura original (snapshot)
  // clientId/clientName = contraparte: cliente en ventas, proveedor en compras (snapshot)
  clientId: string | null;
  clientName: string | null;
  clientDocument?: string | null; // documento de la contraparte (congelado en documentos emitidos)
  supplierInvoiceNumber?: string | null; // solo compras: snapshot del N.º de factura del proveedor
  date: string; // yyyy-MM-dd
  reason: string;
  lines: SaleReturnLine[];
  totals?: InvoiceTotals | null; // calculados por el back: en documentos no editables mandan sobre el cálculo local
  createdAt: string;
  updatedAt: string;
  emittedAt?: string;
  annulledAt?: string;
  annulReason?: string;
  version?: number | null; // bloqueo optimista: se devuelve en cada respuesta y se reenvía al modificar
  issuer?: BillingIssuer | null; // emisor congelado al emitir; null en borrador
}

// Disponibilidad de devolución por línea de la factura original
export interface ReturnAvailabilityLine {
  lineNo: number; // identifica la línea en la factura original (el back devuelve por lineNo, no por producto)
  productId: string;
  productName: string;
  sold: number; // vendido (o comprado) en la factura original
  returned: number; // suma de devoluciones EMITIDA
  available: number; // sold - returned
  precioUnitarioCents: number;
  ivaPct: number;
}

// Lo que el front envía al guardar un borrador (crea si no hay id)
export interface SaleReturnDraftInput {
  id?: string;
  invoiceId: string;
  date: string;
  reason: string;
  lines: { lineNo: number; cantidad: number }[]; // lineNo de la factura original; solo cantidades > 0
  version?: number | null; // versión conocida del borrador (bloqueo optimista)
}

// Fila del listado "Facturas con devolución"
export interface InvoiceWithReturnsSummary {
  invoiceId: string;
  invoiceNumber: string | null;
  kind: DocumentKind;
  supplierInvoiceNumber?: string | null; // solo compras
  clientName: string | null; // contraparte (cliente o proveedor)
  invoiceDate: string;
  invoiceTotalCents: number;
  returnsCount: number; // devoluciones EMITIDA
  returnedTotalCents: number;
  state: InvoiceReturnState;
}
