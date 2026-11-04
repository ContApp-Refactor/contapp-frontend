import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { BillingClient } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingCounterpartyCatalog } from './billing-counterparty-catalog';

const LATENCY_MS = 200;

const MOCK_CLIENTS: BillingClient[] = [
  { id: 'c1', name: 'Distribuidora El Dorado S.A.S.', document: 'NIT 900.123.456-7', category: 'Cliente' },
  { id: 'c2', name: 'Papelería Central Ltda.', document: 'NIT 800.987.654-3', category: 'Cliente' },
  { id: 'c3', name: 'María Fernanda Ortiz', document: 'CC 1.061.234.567', category: 'Cliente' },
  { id: 'c4', name: 'Comercializadora Andina S.A.', document: 'NIT 901.555.222-1', category: 'Cliente' },
];

const MOCK_SUPPLIERS: BillingClient[] = [
  { id: 's1', name: 'Papeles y Útiles del Cauca S.A.S.', document: 'NIT 900.456.789-2', category: 'Proveedor' },
  { id: 's2', name: 'Importadora Escolar Ltda.', document: 'NIT 800.321.654-9', category: 'Proveedor' },
  { id: 's3', name: 'Suministros Industriales Pacífico S.A.', document: 'NIT 901.222.333-5', category: 'Proveedor' },
];

// Contrapartes con datos quemados, mientras Facturación no se conecta a terceros reales.
// Igual que el catálogo real, venta y compra ven TODOS los terceros (clientes y proveedores).
@Injectable()
export class MockBillingCounterpartyCatalog extends BillingCounterpartyCatalog {
  getCounterparties(kind: DocumentKind): Observable<BillingClient[]> {
    const all = [...MOCK_CLIENTS, ...MOCK_SUPPLIERS];
    // El tipo no filtra; solo se ordena primero la contraparte natural del documento
    const source = kind === 'PURCHASE' ? [...MOCK_SUPPLIERS, ...MOCK_CLIENTS] : all;
    return of(structuredClone(source)).pipe(delay(LATENCY_MS));
  }
}
