import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface MenuOption {
  title: string;
  icon: string;
  route: string;
  description?: string;
}

@Component({
  selector: 'app-menu',
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent {

  menuOptions: MenuOption[] = [
    {
      title: 'Catálogo de Cuentas',
      icon: 'account_balance_wallet',
      route: '/gen-masters/account-catalogue',
      description: 'Gestión del plan de cuentas contables'
    },
    {
      title: 'Impuestos',
      icon: 'request_page',
      route: '/gen-masters/taxes/list',
      description: 'Configuración de impuestos y tarifas'
    },
    {
      title: 'Terceros',
      icon: 'groups',
      route: '/gen-masters/third-parties/list',
      description: 'Gestión de clientes y proveedores'
    },
    {
      title: 'Inventario',
      icon: 'data_table',
      route: '/gen-masters/inventory',
      description: 'Configuración de inventarios'
    },
    {
      title: 'Métodos de Pago',
      icon: 'payments',
      route: '/gen-masters/payment-methods/list',
      description: 'Formas de pago disponibles'
    },
    {
      title: 'Tipos de Documentos',
      icon: 'description',
      route: '/gen-masters/document-types/list',
      description: 'Tipos de documentos del sistema'
    },

    {
      title: 'Banco y Cuentas Bancarias',
      icon: 'account_balance',
      route: '/gen-masters/bank-accounts',
      description: 'Gestión de cuentas bancarias'
    },
    {
      title: 'Centros de Costo',
      icon: 'paid',
      route: '/gen-masters/cost-centers',
      description: 'Configuración de centros de costo'
    },
    {
      title: 'Calendario Contable',
      icon: 'date_range',
      route: '/gen-masters/accounting-calendar',
      description: 'Configuración de periodos contables'
    },
    {
      title: 'Etiquetas no comerciales',
      icon: 'label',
      route: '/gen-masters/no-commercial-tags/list',
      description: 'Gestión de etiquetas no comerciales'
    },
    {
      title: 'Centro de Ayuda',
      icon: 'help',
      route: '/gen-masters/help-center/list',
      description: 'Gestión de cuadros de ayuda del sistema'
    }
    
  ];

  constructor(private readonly router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
