// Modelos de la factura de venta. Todos los montos se guardan en CENTAVOS (enteros)
// para evitar errores de redondeo de punto flotante.
// Estos modelos sirven a facturas de venta Y de compra (ver `kind` y models/document-kind.ts).

import { InvoiceReturnState } from './billing-sale-return.model';
import { DocumentKind, WithholdingCode } from './document-kind';

export type InvoiceStatus = 'BORRADOR' | 'EMITIDA' | 'ANULADA';

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  ANULADA: 'Anulada',
};

// Un impuesto del desglose de una línea: nombre tal como está en Inventario ("Iva", "Ica") y tarifa en %.
// Solo presentación: el impuesto de la línea se calcula con `ivaPct` (la SUMA de las tarifas).
export interface BillingLineTax {
  name: string;
  rate: number;
}

export interface BillingProduct {
  id: string;
  code: string;
  name: string;
  priceCents: number; // precio de referencia: de venta (SALE) o costo (PURCHASE), según getProducts(kind)
  ivaPct: number | null; // solo VISTA PREVIA del IVA de la categoría; null = sin dato (el back lo resuelve al guardar)
  taxes?: BillingLineTax[]; // VISTA PREVIA del desglose (impuestos de la categoría); vacío = sin impuestos de categoría
}

// Emisor de la factura. Emitida/anulada: snapshot congelado por el back al emitir (RN-06); borrador: datos vivos de la
// empresa (solo en el GET). Ya NO es null en borrador: para saber si está emitida usar `status`. Los campos de contacto
// son null en facturas emitidas antiguas.
export interface BillingIssuer {
  enterpriseId: string;
  name: string;
  nit: string;
  dv?: string | null;
  active: boolean;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  economicActivity?: string | null; // solo el código (p. ej. "1410")
  logo?: string | null; // URL RELATIVA (/api/enterprises/logos/<key>) o null
}

// Pago de la factura de VENTA (la compra y las devoluciones no lo llevan): solo el método de pago. Billing solo lo registra y lo publica; no procesa pagos.
export interface BillingPayment {
  methodId?: string | null;
  methodName?: string | null; // nombre congelado por el back al emitir (null en borrador)
}

// Método de pago de la empresa (catálogo de Maestros Generales > Métodos de Pago), solo los activos
export interface BillingPaymentMethod {
  id: string;
  name: string;
}

// Contraparte del documento: cliente en ventas, proveedor en compras
export interface BillingClient {
  id: string;
  name: string;
  document: string;
  category?: string; // categoría (tipo) del tercero: "Cliente", "Proveedor", "Cliente/Proveedor"...
  // Datos de contacto para la hoja de la factura (de la respuesta de la factura; null/ausentes = no se muestran)
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface SaleInvoiceLine {
  lineNo?: number; // posición de la línea en la factura (la asigna el back); las devoluciones la referencian
  productId: string;
  productName: string;
  productCode?: string | null; // código/referencia del producto, si el back lo envía en la línea (hoy no); la hoja cae al N.º de línea
  cantidad: number;
  precioCatalogoCents: number; // solo lectura, referencia
  precioUnitarioCents: number; // editable: prevalece sobre el catálogo
  ivaCatalogoPct: number | null; // solo lectura, referencia que resuelve el back (null = sin dato aún, línea nueva sin guardar)
  ivaPct: number | null; // editable: IVA efectivo, prevalece sobre el catálogo (null = sin dato: el back lo resuelve al guardar)
  precioEditado?: boolean; // del back: true si el precio es un override del usuario (false = sigue al catálogo)
  ivaEditado?: boolean; // del back: true si el IVA es un override del usuario (false = sigue al catálogo)
  subtotalCents?: number; // del back: subtotal de la línea; en documentos no editables manda sobre el cálculo local
  // Desglose congelado de impuestos (del back o vista previa del catálogo). Con elementos => solo lectura; vacío/ausente
  // (documento viejo, IVA por defecto o editado a mano) => valor único `ivaPct`, editable en borrador
  taxes?: BillingLineTax[];
}

// Retención de la factura según el back: en borrador usa la tasa vigente del impuesto; en emitida/anulada es el snapshot
// congelado. El monto es round(subtotal × tasa / 100) sobre el SUBTOTAL completo y RESTA del total.
export interface BillingWithholding {
  code: WithholdingCode;
  taxId: string;
  taxName: string;
  ratePct: number;
  amountCents: number;
}

// Retención que el front envía al guardar el borrador (reemplazo total del conjunto)
export interface WithholdingInput {
  code: WithholdingCode;
  taxId: string | number;
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
  // Contacto de la contraparte (congelado al emitir; en borrador refrescado por el back en el GET). null en emitidas antiguas
  clientAddress?: string | null;
  clientCity?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
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
  issuer?: BillingIssuer | null; // emitida/anulada: snapshot congelado; borrador: datos vivos de la empresa (no usar para saber si está emitida)
  verificationCode?: string | null; // string opaco (UUID/CUFE) solo en emitidas/anuladas; el QR lo codifica tal cual
  payment?: BillingPayment | null; // forma de pago (venta y compra); null/ausente en facturas anteriores a este dato
  withholdings?: BillingWithholding[]; // retenciones (venta y compra); vacío/ausente = sin retenciones
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
  payment?: BillingPayment | null; // venta y compra; null = sin forma de pago todavía
  withholdings?: WithholdingInput[]; // reemplazo total; vacío/ausente = sin retenciones
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
  withholdingsCents?: number; // suma de las retenciones (siempre 0 en devoluciones); ausente = sin dato
  totalCents: number; // YA NETO: subtotal + impuestos − retenciones
}
