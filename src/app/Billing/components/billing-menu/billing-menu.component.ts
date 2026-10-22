import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

interface BillingOption {
  title: string;
  icon: string;
  route: string;
  position: string;
}

@Component({
  selector: 'app-billing-menu',
  templateUrl: './billing-menu.component.html',
})
export class BillingMenuComponent {
  private readonly router = inject(Router);

  // Cruz sobre una grilla de 4 columnas: cada tarjeta ocupa 2 columnas
  options: BillingOption[] = [
    {
      title: 'Continuar factura pendiente',
      icon: 'pending_actions',
      route: '/billing/pending',
      position: 'col-start-2 col-span-2 row-start-1',
    },
    {
      title: 'Nueva Factura Compra',
      icon: 'shopping_cart',
      route: '/billing/purchase/new',
      position: 'col-start-1 col-span-2 row-start-2',
    },
    {
      title: 'Nueva Factura Venta',
      icon: 'point_of_sale',
      route: '/billing/sale/new',
      position: 'col-start-3 col-span-2 row-start-2',
    },
    {
      title: 'Ver facturas',
      icon: 'receipt_long',
      route: '/billing/list',
      position: 'col-start-1 col-span-2 row-start-3',
    },
    {
      title: 'Facturas con devolución',
      icon: 'assignment_return',
      route: '/billing/returns',
      position: 'col-start-3 col-span-2 row-start-3',
    },
  ];

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
