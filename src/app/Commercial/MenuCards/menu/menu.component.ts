import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface MenuOption {
  title: string;
  icon: string;
  route: string;
  description: string;
}

@Component({
  selector: 'app-commercial-menu',
  imports: [CommonModule],
  templateUrl: './menu.component.html',
})
export class MenuComponent {
  menuOptions: MenuOption[] = [
    {
      title: 'Maestros Comerciales',
      icon: 'inventory_2',
      route: '/commercial/business-masters',
      description: 'Configuración y gestión de inventarios',
    },
    {
      title: 'Factura de Venta',
      icon: 'point_of_sale',
      route: '/commercial/sale-invoice',
      description: 'Gestión de facturas de venta',
    },
    {
      title: 'Factura de Compra',
      icon: 'shopping_cart',
      route: '/commercial/purchase-invoice',
      description: 'Gestión de facturas de compra',
    },
    {
      title: 'Plantilla de Factura',
      icon: 'description',
      route: '/commercial/invoice-template',
      description: 'Configuración de plantillas de factura',
    },
    {
      title: 'Plantilla de Devolución',
      icon: 'assignment_return',
      route: '/commercial/return-template',
      description: 'Configuración de plantillas de devolución',
    },
    {
      title: 'Plantilla de Evento no Comercial',
      icon: 'article',
      route: '/commercial/non-commercial-template',
      description: 'Configuración de eventos no comerciales',
    },
  ];

  constructor(private readonly router: Router) { }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}