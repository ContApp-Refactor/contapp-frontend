import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, delay, forkJoin, map, of, switchMap } from 'rxjs';
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
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { concurrentModificationError } from '../utils/billing-error';
import { calcTotals, lineSubtotalCents, roundQty } from '../utils/money';
import { deriveReturnState } from '../utils/sale-return';
import { hasEmittedReturns, readSaleReturns } from './sale-return-store';

const INVOICES_KEY = 'billing_sale_invoices';
// Secuencia independiente por tipo (la de venta conserva su clave histórica)
const SEQUENCE_KEY: Record<DocumentKind, string> = {
  SALE: 'billing_sale_invoice_seq',
  PURCHASE: 'billing_purchase_invoice_seq',
};
const LATENCY_MS = 200;
// Respaldo de IVA cuando no hay dato de catálogo (equivale a billing.default-vat-rate del back)
const DEFAULT_VAT_RATE = 19;

// Implementación simulada: persiste en localStorage y responde con una latencia pequeña.
// Las escrituras ocurren de forma síncrona al llamar, así un guardado disparado al
// destruir el componente no se pierde aunque nadie espere la respuesta.
// Facturas de venta y de compra comparten almacén; se distinguen por `kind`.
// Reglas alineadas con el back: cantidad > 0 (hasta 3 decimales), un precio sin override sigue al catálogo (se
// refresca al leer el borrador y al guardar), un IVA sin override (ivaPct null o igual a la referencia) también sigue
// al catálogo con respaldo de 19%, el emisor y el tercero se congelan al emitir, emitir dos veces devuelve el documento
// y `version` se verifica solo si llega; `returnStatus` se deriva al leer de las devoluciones emitidas. No es fiel en: concurrencia
// real (mock no fiel) ni en el orden exacto de validación al emitir.
@Injectable()
export class MockBillingSaleInvoiceApi extends BillingSaleInvoiceApi {
  // Las referencias de catálogo de cada línea se resuelven con el catálogo real de productos
  private readonly catalog = inject(BillingProductCatalog);
  private readonly counterparties = inject(BillingCounterpartyCatalog);
  private readonly storage = inject(LocalStorageMethods);

  list(status?: InvoiceStatus): Observable<SaleInvoice[]> {
    return defer(() => {
      const all = this.readAll()
        .filter((i) => !status || i.status === status)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return this.refreshed(all).pipe(map((list) => this.withReturnStatus(list)), delay(LATENCY_MS));
    });
  }

  getById(id: string): Observable<SaleInvoice> {
    return defer(() =>
      this.refreshed([this.findOrThrow(this.readAll(), id)]).pipe(
        map((list) => this.withReturnStatus(list)[0]),
        delay(LATENCY_MS),
      ),
    );
  }

  // Como el back, las facturas emitidas traen `returnStatus` derivado de sus devoluciones EMITIDA (así el listado oculta
  // "Devolver factura completa" en las ya devueltas del todo). Se calcula al leer, no se guarda.
  private withReturnStatus(invoices: SaleInvoice[]): SaleInvoice[] {
    const returns = readSaleReturns().filter((r) => r.status === 'EMITIDA');
    for (const invoice of invoices) {
      if (invoice.status === 'BORRADOR') continue;
      invoice.returnStatus = deriveReturnState(
        invoice.lines,
        returns.filter((r) => r.invoiceId === invoice.id),
      );
    }
    return invoices;
  }

  // Como el back, al leer un borrador la referencia de catálogo se refresca y las líneas sin override siguen al catálogo
  private refreshed(invoices: SaleInvoice[]): Observable<SaleInvoice[]> {
    const drafts = invoices.filter((i) => i.status === 'BORRADOR' && i.lines.length > 0);
    if (drafts.length === 0) return of(invoices);
    const kinds = [...new Set(drafts.map((d) => d.kind))];
    return forkJoin(kinds.map((k) => this.catalog.getProducts(k))).pipe(
      map((catalogs) => {
        for (const draft of drafts) {
          const products = catalogs[kinds.indexOf(draft.kind)];
          for (const line of draft.lines) {
            const product = products.find((p) => p.id === line.productId);
            if (!product) continue;
            line.precioCatalogoCents = product.priceCents;
            if (line.precioEditado === false) line.precioUnitarioCents = product.priceCents;
            if (product.ivaPct != null) {
              line.ivaCatalogoPct = product.ivaPct;
              if (line.ivaEditado === false) line.ivaPct = product.ivaPct;
            }
          }
        }
        return invoices;
      }),
      catchError(() => of(invoices)), // sin catálogo se devuelve lo guardado
    );
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
        this.assertVersion(invoice, input.version);
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
          version: 0,
        };
        all.push(invoice);
      }

      invoice.clientId = client?.id ?? null;
      invoice.clientName = client?.name ?? null;
      invoice.clientDocument = client?.document ?? null;
      if (invoice.kind === 'PURCHASE') invoice.supplierInvoiceNumber = input.supplierInvoiceNumber?.trim() || null;
      invoice.date = input.date;
      const previousLines = invoice.lines;
      invoice.lines = input.lines.map((l, index) => {
        const product = catalog.find((p) => p.id === l.productId);
        // Un producto que ya estaba en el borrador pero hoy no está en el catálogo activo
        // (desactivado/eliminado o dato legacy del mock) conserva sus referencias previas.
        const previous = previousLines.find((p) => p.productId === l.productId);
        if (!product && !previous) throw new Error(`El producto ${l.productName} no existe.`);
        // Igual que el back (@Positive, escala máxima 3): también en borrador la cantidad debe ser > 0
        if (!(l.cantidad > 0)) throw new Error('La cantidad debe ser mayor que cero.');
        if (roundQty(l.cantidad) !== l.cantidad) throw new Error('La cantidad admite máximo 3 decimales.');
        if (l.ivaPct != null && (!Number.isFinite(l.ivaPct) || l.ivaPct < 0 || l.ivaPct > 100)) {
          throw new Error('El IVA debe estar entre 0 y 100.');
        }
        const referenceCents = product ? product.priceCents : previous!.precioCatalogoCents;
        // Regla del back (igual que el IVA): con bandera `precioEditado` manda la bandera; sin ella (línea nueva) un precio
        // igual a la referencia que el front conocía sigue al catálogo
        const edited =
          l.precioEditado ?? !(l.precioCatalogoCents !== undefined && l.precioUnitarioCents === l.precioCatalogoCents);
        // Mismo criterio para el IVA que el adaptador HTTP: sin dato (null) sigue al catálogo; con bandera manda la bandera
        const ivaEdited =
          l.ivaPct != null &&
          (l.ivaEditado ?? !(l.ivaCatalogoPct != null && l.ivaPct === l.ivaCatalogoPct));
        // Referencia de IVA: la del catálogo si hay dato; si no la previa y, en última instancia, el respaldo del back
        const ivaReference = product?.ivaPct ?? previous?.ivaCatalogoPct ?? DEFAULT_VAT_RATE;
        return {
          lineNo: index + 1,
          productId: l.productId,
          productName: l.productName,
          cantidad: l.cantidad,
          precioUnitarioCents: edited ? l.precioUnitarioCents : referenceCents,
          precioEditado: edited,
          ivaPct: ivaEdited ? l.ivaPct : ivaReference, // efectivo: prevalece el del usuario
          ivaEditado: ivaEdited,
          // referencias: siempre del producto (del catálogo si existe)
          precioCatalogoCents: referenceCents,
          ivaCatalogoPct: ivaReference,
        };
      });
      invoice.updatedAt = now;
      invoice.version = (invoice.version ?? 0) + 1;

      this.writeAll(all);
      return of(structuredClone(invoice)).pipe(delay(LATENCY_MS));
    });
  }

  deleteDraft(id: string, version?: number | null): Observable<void> {
    return defer(() => {
      const all = this.readAll();
      const draft = this.findOrThrow(all, id);
      this.assertDraft(draft);
      this.assertVersion(draft, version);
      this.writeAll(all.filter((i) => i.id !== id));
      return of(void 0).pipe(delay(LATENCY_MS));
    });
  }

  emit(id: string, version?: number | null): Observable<SaleInvoice> {
    return defer(() => {
      const all = this.readAll();
      const invoice = this.findOrThrow(all, id);
      // Como el back: emitir dos veces es idempotente y devuelve el documento ya emitido
      if (invoice.status === 'EMITIDA') return of(structuredClone(invoice)).pipe(delay(LATENCY_MS));
      this.assertDraft(invoice);
      this.assertVersion(invoice, version);
      // Como el back, antes de congelar se refresca el catálogo (precio e IVA de las líneas sin override)
      return this.refreshed([invoice]).pipe(map(() => this.freeze(all, invoice)), delay(LATENCY_MS));
    });
  }

  private freeze(all: SaleInvoice[], invoice: SaleInvoice): SaleInvoice {
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
    // RN-06: el emisor se congela al emitir (copia de los datos de la empresa en ese momento)
    const enterprise = this.storage.loadEnterpriseData();
    invoice.issuer = {
      enterpriseId: enterprise?.id ?? '',
      name: enterprise?.name || 'Empresa',
      nit: enterprise?.nit ?? '',
      dv: null,
      active: true,
    };
    for (const line of invoice.lines) line.subtotalCents = lineSubtotalCents(line); // congelado por línea, como el back
    invoice.totals = calcTotals(invoice.lines);
    invoice.version = (invoice.version ?? 0) + 1;

    this.writeAll(all);
    return structuredClone(invoice);
  }

  annul(id: string, reason: string, version?: number | null): Observable<SaleInvoice> {
    return defer(() => {
      const all = this.readAll();
      const invoice = this.findOrThrow(all, id);
      // Como el back: anular una factura ya ANULADA es idempotente (devuelve el documento, sin verificar la versión)
      if (invoice.status === 'ANULADA') return of(structuredClone(invoice)).pipe(delay(LATENCY_MS));
      this.assertVersion(invoice, version);
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
      invoice.version = (invoice.version ?? 0) + 1;

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

  // Bloqueo optimista: solo se verifica si llega una versión (como el back)
  private assertVersion(invoice: SaleInvoice, version?: number | null): void {
    if (version != null && version !== (invoice.version ?? 0)) throw concurrentModificationError();
  }

  private assertDraft(invoice: SaleInvoice): void {
    if (invoice.status !== 'BORRADOR') {
      throw new Error('Solo los borradores se pueden modificar o eliminar.');
    }
  }
}
