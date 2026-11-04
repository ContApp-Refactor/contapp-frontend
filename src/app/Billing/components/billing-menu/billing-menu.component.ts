import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SaleInvoicePendingComponent } from '../sale-invoice-pending/sale-invoice-pending.component';

interface BillingOption {
  title: string;
  icon: string;
  route: string;
  primary: boolean; // true = acción de crear (botón relleno); false = consulta (botón con contorno)
}

@Component({
  selector: 'app-billing-menu',
  imports: [ButtonModule, SaleInvoicePendingComponent],
  templateUrl: './billing-menu.component.html',
})
export class BillingMenuComponent {
  private readonly router = inject(Router);

  // "Continuar factura pendiente" ya no es un botón: los borradores se listan en la tabla de esta misma pantalla
  options: BillingOption[] = [
    { title: 'Nueva factura de compra', icon: 'pi pi-shopping-cart', route: '/billing/purchase/new', primary: true },
    { title: 'Nueva factura de venta', icon: 'pi pi-dollar', route: '/billing/sale/new', primary: true },
    { title: 'Ver facturas', icon: 'pi pi-list', route: '/billing/list', primary: false },
    { title: 'Facturas con devolución', icon: 'pi pi-replay', route: '/billing/returns', primary: false },
  ];

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
