import { Injectable } from '@angular/core';
import { DocumentKind } from '../models/document-kind';

export const INVOICE_BASE: Record<DocumentKind, string> = {
  SALE: '/api/billing/sale-invoices',
  PURCHASE: '/api/billing/purchase-invoices',
};

export const RETURN_BASE: Record<DocumentKind, string> = {
  SALE: '/api/billing/sale-returns',
  PURCHASE: '/api/billing/purchase-returns',
};

// El back decide el tipo por la ruta, así que hay que recordar de qué tipo es cada id (factura o devolución)
@Injectable({ providedIn: 'root' })
export class BillingDocumentKindRegistry {
  private readonly kinds = new Map<string, DocumentKind>();

  remember(id: string, kind: DocumentKind): void {
    this.kinds.set(id, kind);
  }

  kindOf(id: string): DocumentKind | undefined {
    return this.kinds.get(id);
  }
}
