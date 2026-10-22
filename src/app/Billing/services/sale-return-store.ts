import { DocumentKind, DOCUMENT_KIND_CONFIG } from '../models/document-kind';
import { SaleReturn } from '../models/billing-sale-return.model';

// Acceso compartido al "almacén" localStorage de devoluciones (de venta y de compra, mismo almacén).
// Lo usan el mock de devoluciones y el mock de facturas (para impedir anular una factura con
// devoluciones emitidas) sin que un servicio dependa del otro por DI (evita dependencia circular).
// Solo para los mocks.

const RETURNS_KEY = 'billing_sale_returns';
// Secuencia independiente por tipo (la de venta conserva su clave histórica)
const RETURN_SEQUENCE_KEY: Record<DocumentKind, string> = {
  SALE: 'billing_sale_return_seq',
  PURCHASE: 'billing_purchase_return_seq',
};

export function readSaleReturns(): SaleReturn[] {
  try {
    const returns = JSON.parse(localStorage.getItem(RETURNS_KEY) ?? '[]') as SaleReturn[];
    // Devoluciones guardadas antes de existir `kind` son de venta
    for (const r of returns) r.kind ??= 'SALE';
    return returns;
  } catch {
    return [];
  }
}

export function writeSaleReturns(returns: SaleReturn[]): void {
  localStorage.setItem(RETURNS_KEY, JSON.stringify(returns));
}

export function nextReturnNumber(kind: DocumentKind): string {
  const key = RETURN_SEQUENCE_KEY[kind];
  const next = Number(localStorage.getItem(key) ?? '0') + 1;
  localStorage.setItem(key, String(next));
  return `${DOCUMENT_KIND_CONFIG[kind].returnPrefix}${String(next).padStart(6, '0')}`;
}

export function hasEmittedReturns(invoiceId: string): boolean {
  return readSaleReturns().some((r) => r.invoiceId === invoiceId && r.status === 'EMITIDA');
}
