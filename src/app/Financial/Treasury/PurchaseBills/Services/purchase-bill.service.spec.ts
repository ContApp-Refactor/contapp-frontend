import { of } from 'rxjs';
import { PurchaseBillService } from './purchase-bill.service';

describe('PurchaseBillService suppliers', () => {
  it('enriches CxP suppliers with third party names', (done) => {
    const api = {
      pending: jasmine.createSpy('pending').and.returnValue(
        of([
          {
            supplierId: 7,
            payableAccountId: 2205,
            payableAccountCode: '2205',
          },
        ]),
      ),
    };
    const thirds = {
      getThirdParties: jasmine.createSpy('getThirdParties').and.returnValue(
        of({
          content: [{ thId: 7, socialReason: 'Distribuidora Andina' }],
        }),
      ),
    };
    const storage = { getIdEnterprise: () => 'ent-1' };
    const service = new PurchaseBillService(api as any, {} as any, thirds as any, storage as any);

    service.getSuppliers('andina').subscribe((suppliers) => {
      expect(suppliers.length).toBe(1);
      expect(suppliers[0].name).toBe('Distribuidora Andina');
      expect(suppliers[0].id).toBe(7);
      done();
    });
  });

  it('only returns suppliers with pending payables', (done) => {
    const api = {
      pending: jasmine.createSpy('pending').and.returnValue(
        of([{ supplierId: 3, payableAccountId: 1, payableAccountCode: '2205' }]),
      ),
    };
    const thirds = {
      getThirdParties: jasmine.createSpy('getThirdParties').and.returnValue(
        of({ content: [{ thId: 3, socialReason: 'CxP Activa' }, { thId: 99, socialReason: 'Sin CxP' }] }),
      ),
    };
    const storage = { getIdEnterprise: () => 'ent-1' };
    const service = new PurchaseBillService(api as any, {} as any, thirds as any, storage as any);

    service.getSuppliers('').subscribe((suppliers) => {
      expect(suppliers.map((s) => s.id)).toEqual([3]);
      done();
    });
  });
});
