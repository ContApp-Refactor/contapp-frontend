import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, forkJoin, of, switchMap } from 'rxjs';
import {
  BillingClient,
  BillingProduct,
  InvoiceStatus,
  SaleInvoice,
  SaleInvoiceDraftInput,
} from '../models/billing-sale-invoice.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../models/document-kind';
import { BillingCounterpartyCatalog } from './billing-counterparty-catalog';
import { BillingProductCatalog } from './billing-product-catalog';
import { BillingSaleInvoiceApi } from './billing-sale-invoice.api';
import { hasEmittedReturns } from './sale-return-store';

const INVOICES_KEY = 'billing_sale_invoices';
// Secuencia independiente por tipo (la de venta conserva su clave histórica)
const SEQUENCE_KEY: Record<DocumentKind, string> = {
  SALE: 'billing_sale_invoice_seq',
  PURCHASE: 'billing_purchase_invoice_seq',
};
const LATENCY_MS = 200;

// Implementación simulada: persiste en localStorage y responde con una latencia pequeña.
// Las escrituras ocurren de forma síncrona al llamar, así un guardado disparado al
// destruir el componente no se pierde aunque nadie espere la respuesta.
// Facturas de venta y de compra comparten almacén; se distinguen por `kind`.
@Injectable()
export class MockBillingSaleInvoiceApi extends BillingSaleInvoiceApi {
  // Las referencias de catálogo de cada línea se resuelven con el catálogo real de productos
  private readonly catalog = inject(BillingProductCatalog);
  private readonly counterparties = inject(BillingCounterpartyCatalog);

  list(status?: InvoiceStatus): Observable<SaleInvoice[]> {
    return defer(() => {
      const all = this.readAll()
        .filter((i) => !status || i.status === status)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return of(all).pipe(delay(LATENCY_MS));
    });
  }

  getById(id: string): Observable<SaleInvoice> {
    return defer(() => of(this.findOrThrow(this.readAll(), id)).pipe(delay(LATENCY_MS)));
  }

  saveDraft(input: SaleInvoiceDraftInput): Observable<SaleInvoice> {
    return defer(() => {
      // Al actualizar prevalece el kind guardado; los catálogos se piden según ese kind
      const kind = input.id ? this.findOrThrow(this.readAll(), input.id).kind : input.kind;
      return forkJoin([
        input.lines.length > 0 ? this.catalog.getProducts(kind) : of<BillingProduct[]>([]),
        this.counterparties.getCounterparties(kind),
      ]).pipe(switchMap(([catalog, counterparties]) => this.writeDraft(input, catalog, counterparties)));
    });
  }

  private writeDraft(
    input: SaleInvoiceDraftInput,
    catalog: BillingProduct[],
    counterparties: BillingClient[],
  ): Observable<SaleInvoice> {
    return defer(() => {
      const all = this.readAll();
      const now = new Date().toISOString();
      const client = counterparties.find((c) => c.id === input.clientId);

      let invoice: SaleInvoice;
      if (input.id) {
        invoice = this.findOrThrow(all, input.id);
        this.assertDraft(invoice);
      } else {
        invoice = {
          id: crypto.randomUUID(),
          number: null,
          status: 'BORRADOR',
          kind: input.kind,
          clientId: null,
          clientName: null,
          date: input.date,
          lines: [],
          createdAt: now,
          updatedAt: now,
        };
        all.push(invoice);
      }

      invoice.clientId = client?.id ?? null;
      invoice.clientName = client?.name ?? null;
      if (invoice.kind === 'PURCHASE') invoice.supplierInvoiceNumber = input.supplierInvoiceNumber?.trim() || null;
      invoice.date = input.date;
      const previousLines = invoice.lines;
      invoice.lines = input.lines.map((l) => {
        const product = catalog.find((p) => p.id === l.productId);
        // Un producto que ya estaba en el borrador pero hoy no está en el catálogo activo
        // (desactivado/eliminado o dato legacy del mock) conserva sus referencias previas.
        const previous = previousLines.find((p) => p.productId === l.productId);
        if (!product && !previous) throw new Error(`El producto ${l.productName} no existe.`);
        if (!Number.isFinite(l.ivaPct) || l.ivaPct < 0 || l.ivaPct > 100) {
          throw new Error('El IVA debe estar entre 0 y 100.');
        }
        return {
          productId: l.productId,
          productName: l.productName,
          cantidad: l.cantidad,
          precioUnitarioCents: l.precioUnitarioCents,
          ivaPct: l.ivaPct, // efectivo: prevalece el del usuario
          // referencias: siempre del producto (del catálogo si existe)
          precioCatalogoCents: product ? product.priceCents : previous!.precioCatalogoCents,
          ivaCatalogoPct: product ? product.ivaPct : previous!.ivaCatalogoPct,
        };
      });
      invoice.updatedAt = now;

      this.writeAll(all);
      return of(structuredClone(invoice)).pipe(delay(LATENCY_MS));
    });
  }

  deleteDraft(id: string): Observable<void> {
    return defer(() => {
      const all = this.readAll();
      this.assertDraft(this.findOrThrow(all, id));
      this.writeAll(all.filter((i) => i.id !== id));
      return of(void 0).pipe(delay(LATENCY_MS));
    });
  }

  emit(id: string): Observable<SaleInvoice> {
    return defer(() => {
      const all = this.readAll();
      const invoice = this.findOrThrow(all, id);
      this.assertDraft(invoice);

      // Las mismas reglas que validará el backend real
      if (!invoice.clientId) {
        throw new Error(`Debes seleccionar un ${DOCUMENT_KIND_CONFIG[invoice.kind].counterpartyLower}.`);
      }
      if (invoice.kind === 'PURCHASE' && !invoice.supplierInvoiceNumber?.trim()) {
        throw new Error('Debes ingresar el N.º de factura del proveedor.');
      }
      if (invoice.lines.length === 0) throw new Error('La factura debe tener al menos una línea.');
      if (invoice.lines.some((l) => !(l.cantidad > 0))) {
        throw new Error('Todas las líneas deben tener cantidad mayor a cero.');
      }

      const now = new Date().toISOString();
      invoice.number = this.nextNumber(invoice.kind);
      invoice.status = 'EMITIDA';
      invoice.emittedAt = now;
      invoice.updatedAt = now;

      this.writeAll(all);
      return of(structuredClone(invoice)).pipe(delay(LATENCY_MS));
    });
  }

  annul(id: string, reason: string): Observable<SaleInvoice> {
    return defer(() => {
      const all = this.readAll();
      const invoice = this.findOrThrow(all, id);
      if (invoice.status !== 'EMITIDA') throw new Error('Solo se pueden anular facturas emitidas.');
      if (!reason?.trim()) throw new Error('El motivo de anulación es obligatorio.');
      // Una factura con devoluciones emitidas no se anula hasta anular primero esas devoluciones
      if (hasEmittedReturns(id)) {
        throw new Error('No se puede anular: la factura tiene devoluciones emitidas. Anula primero las devoluciones.');
      }

      const now = new Date().toISOString();
      invoice.status = 'ANULADA';
      invoice.annulReason = reason.trim();
      invoice.annulledAt = now;
      invoice.updatedAt = now;

      this.writeAll(all);
      return of(structuredClone(invoice)).pipe(delay(LATENCY_MS));
    });
  }

  // --- helpers de persistencia ---

  private readAll(): SaleInvoice[] {
    try {
      const invoices = JSON.parse(localStorage.getItem(INVOICES_KEY) ?? '[]') as SaleInvoice[];
      for (const inv of invoices) {
        // Migración: facturas guardadas antes de existir `kind` son de venta
        inv.kind ??= 'SALE';
        // Migración: facturas guardadas antes de existir ivaCatalogoPct
        for (const line of inv.lines) {
          line.ivaCatalogoPct ??= line.ivaPct;
        }
      }
      return invoices;
    } catch {
      return [];
    }
  }

  private writeAll(invoices: SaleInvoice[]): void {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  }

  private nextNumber(kind: DocumentKind): string {
    const key = SEQUENCE_KEY[kind];
    const next = Number(localStorage.getItem(key) ?? '0') + 1;
    localStorage.setItem(key, String(next));
    return `${DOCUMENT_KIND_CONFIG[kind].invoicePrefix}${String(next).padStart(6, '0')}`;
  }

  private findOrThrow(all: SaleInvoice[], id: string): SaleInvoice {
    const invoice = all.find((i) => i.id === id);
    if (!invoice) throw new Error('La factura no existe.');
    return invoice;
  }

  private assertDraft(invoice: SaleInvoice): void {
    if (invoice.status !== 'BORRADOR') {
      throw new Error('Solo los borradores se pueden modificar o eliminar.');
    }
  }
}
