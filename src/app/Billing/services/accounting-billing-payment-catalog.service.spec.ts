import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { AccountingBillingPaymentCatalog } from './accounting-billing-payment-catalog.service';

describe('AccountingBillingPaymentCatalog (catálogo propio de Billing)', () => {
  let catalog: AccountingBillingPaymentCatalog;
  let httpMock: HttpTestingController;
  let enterpriseId = 'ent-1';

  beforeEach(() => {
    enterpriseId = 'ent-1';
    TestBed.configureTestingModule({
      providers: [
        AccountingBillingPaymentCatalog,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LocalStorageMethods, useValue: { getIdEnterprise: () => enterpriseId } },
      ],
    });
    catalog = TestBed.inject(AccountingBillingPaymentCatalog);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lista los métodos desde /api/billing/payment-catalog/methods como [{id, name}] e ignora campos de banco', async () => {
    const promise = firstValueFrom(catalog.getPaymentMethods());
    const req = httpMock.expectOne('/api/billing/payment-catalog/methods?enterpriseId=ent-1');
    expect(req.request.method).toBe('GET');
    req.flush([
      { id: 7, name: 'Efectivo' },
      { id: '9', name: 'Transferencia bancaria', requiresBankAccount: true },
    ]);
    expect(await promise).toEqual([
      { id: '7', name: 'Efectivo' },
      { id: '9', name: 'Transferencia bancaria' },
    ]);
  });

  it('sin métodos => lista vacía (no es un error)', async () => {
    const promise = firstValueFrom(catalog.getPaymentMethods());
    httpMock.expectOne('/api/billing/payment-catalog/methods?enterpriseId=ent-1').flush([]);
    expect(await promise).toEqual([]);
  });

  it('un fallo del servidor se propaga (no se confunde con "no hay métodos")', async () => {
    const promise = firstValueFrom(catalog.getPaymentMethods());
    httpMock
      .expectOne('/api/billing/payment-catalog/methods?enterpriseId=ent-1')
      .flush('error', { status: 500, statusText: 'Server Error' });
    await expectAsync(promise).toBeRejected();
  });

  it('sin empresa seleccionada no consulta nada', async () => {
    enterpriseId = '';
    expect(await firstValueFrom(catalog.getPaymentMethods())).toEqual([]);
  });

  it('el catálogo ya no expone cuentas bancarias', () => {
    expect('getBankAccounts' in catalog).toBeFalse();
  });
});
