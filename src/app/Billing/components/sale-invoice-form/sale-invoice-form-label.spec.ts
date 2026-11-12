import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { BillingCounterpartyCatalog } from '../../services/billing-counterparty-catalog';
import { BillingProductCatalog } from '../../services/billing-product-catalog';
import { BillingPaymentCatalog } from '../../services/billing-payment-catalog';
import { BillingTaxCatalog } from '../../services/billing-tax-catalog';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { SaleInvoiceFormComponent } from './sale-invoice-form.component';

describe('Formulario de factura: etiqueta del selector de tercero', () => {
  const draft = {
    id: 'i1', number: null, status: 'BORRADOR', kind: 'SALE', clientId: 'c1', clientName: 'Raul Perez', date: '2026-10-01',
    createdAt: '', updatedAt: '', version: 1, lines: [],
  };
  it('formatea "NIT - Nombre" y deja solo el nombre si no hay NIT', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideNoopAnimations(), provideHttpClient(), MessageService,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { kind: 'SALE' }, paramMap: convertToParamMap({ id: 'i1' }) } } },
        { provide: BillingSaleInvoiceApi, useValue: { getById: () => of(structuredClone(draft)), saveDraft: () => of(draft) } },
        { provide: BillingSaleReturnApi, useValue: { listByInvoice: () => of([]), getAvailability: () => of([]) } },
        { provide: BillingProductCatalog, useValue: { getProducts: () => of([]) } },
        { provide: BillingPaymentCatalog, useValue: { getPaymentMethods: () => of([]) } },
        { provide: BillingTaxCatalog, useValue: { getTaxes: () => of([]) } },
        { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of([
          { id: 'c1', name: 'Raul Perez', document: '100000' },
          { id: 'c2', name: 'Sin Nit', document: '' },
        ]) } },
      ],
    });
    const fixture = TestBed.createComponent(SaleInvoiceFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const labels = fixture.componentInstance.clientOptions().map((o) => o.label);
    expect(labels).toEqual(['100000 - Raul Perez', 'Sin Nit']);
  });
});
