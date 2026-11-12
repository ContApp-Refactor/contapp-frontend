import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { TaxService } from '../../GeneralMasters/Taxes/services/tax.service';
import { BillingTax, BillingTaxCatalog } from './billing-tax-catalog';

// Adaptador: reutiliza el TaxService de Maestros Generales (impuestos activos de la empresa).
@Injectable()
export class GeneralMastersBillingTaxCatalog extends BillingTaxCatalog {
  private readonly taxService = inject(TaxService);
  private readonly storage = inject(LocalStorageMethods);

  getTaxes(): Observable<BillingTax[]> {
    const enterpriseId = this.storage.getIdEnterprise();
    if (!enterpriseId) return of([]);
    return this.taxService
      .getActiveTaxes(enterpriseId)
      .pipe(map((list) => (list ?? []).map((t) => ({ id: String(t.id), name: t.description, rate: t.interest }))));
  }
}
