import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { PaymentMethodsListComponent } from './payment-methods-list.component';
import { PaymentMethodsServiceService } from '../../services/payment-methods-service.service';
import { ChartAccountService } from '../../../AccountCatalogue/services/chart-account.service';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';

describe('PaymentMethodsListComponent', () => {
  let component: PaymentMethodsListComponent;
  let fixture: ComponentFixture<PaymentMethodsListComponent>;

  async function setup(query: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [PaymentMethodsListComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
        { provide: PaymentMethodsServiceService, useValue: { findAll: () => of({ content: [], totalElements: 0 }) } },
        { provide: ChartAccountService, useValue: { getListAccounts: () => of([]) } },
        { provide: LocalStorageMethods, useValue: { getIdEnterprise: () => 'e1' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentMethodsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const backButton = (): HTMLElement | null =>
    Array.from(fixture.nativeElement.querySelectorAll('p-button') as NodeListOf<HTMLElement>).find((b) =>
      (b.textContent ?? '').includes('Volver a factura'),
    ) ?? null;

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('sin returnTo no muestra "Volver a factura"', async () => {
    await setup();
    expect(component.returnTo).toBeNull();
    expect(backButton()).toBeNull();
  });

  it('con returnTo inválido (fuera de /billing/) no muestra el botón', async () => {
    await setup({ returnTo: 'https://evil.com' });
    expect(backButton()).toBeNull();
  });

  it('con returnTo de Facturación muestra el botón y vuelve a la factura', async () => {
    await setup({ returnTo: '/billing/sales/abc', returnLabel: 'factura' });
    expect(backButton()).not.toBeNull();
    const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    component.goBackToInvoice();
    expect(navigateByUrl).toHaveBeenCalledWith('/billing/sales/abc');
  });
});
