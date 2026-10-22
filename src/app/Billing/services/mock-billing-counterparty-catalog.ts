import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { BillingClient } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingCounterpartyCatalog } from './billing-counterparty-catalog';

const LATENCY_MS = 200;

const MOCK_CLIENTS: BillingClient[] = [
  { id: 'c1', name: 'Distribuidora El Dorado S.A.S.', document: 'NIT 900.123.456-7' },
  { id: 'c2', name: 'Papelería Central Ltda.', document: 'NIT 800.987.654-3' },
  { id: 'c3', name: 'María Fernanda Ortiz', document: 'CC 1.061.234.567' },
  { id: 'c4', name: 'Comercializadora Andina S.A.', document: 'NIT 901.555.222-1' },
];

const MOCK_SUPPLIERS: BillingClient[] = [
  { id: 's1', name: 'Papeles y Útiles del Cauca S.A.S.', document: 'NIT 900.456.789-2' },
  { id: 's2', name: 'Importadora Escolar Ltda.', document: 'NIT 800.321.654-9' },
  { id: 's3', name: 'Suministros Industriales Pacífico S.A.', document: 'NIT 901.222.333-5' },
];

// Contrapartes con datos quemados, mientras Facturación no se conecta a clientes/proveedores reales.
@Injectable()
export class MockBillingCounterpartyCatalog extends BillingCounterpartyCatalog {
  getCounterparties(kind: DocumentKind): Observable<BillingClient[]> {
    const source = kind === 'PURCHASE' ? MOCK_SUPPLIERS : MOCK_CLIENTS;
    return of(structuredClone(source)).pipe(delay(LATENCY_MS));
  }
}
