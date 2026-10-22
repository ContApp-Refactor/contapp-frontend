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
  selector: 'app-wallet-menu',
  imports: [CommonModule],
  templateUrl: './menu.component.html',
})
export class MenuComponent {

  menuOptions: MenuOption[] = [
    {
      title: 'Recibos de Caja',
      icon: 'receipt_long',
      route: '/financial/wallet/receipts',
      description: 'Gestión y consulta de recibos de caja',
    },
    {
      title: 'Castigos de Cartera',
      icon: 'money_off',
      route: '/financial/wallet/write-offs',
      description: 'Gestión de castigos de cartera',
    },
    {
      title: 'Asientos Contables',
      icon: 'account_balance',
      route: '/financial/wallet/accounting-entries',
      description: 'Consulta de asientos contables de cartera',
    },
    {
      title: 'Facturas',
      icon: 'receipt',
      route: '/financial/wallet/invoices',
      description: 'Gestión y consulta de facturas',
    },
    {
      title: 'Reportes',
      icon: 'assessment',
      route: '/financial/wallet/reports',
      description: 'Consulta de reportes de cartera',
    },
  ];

  constructor(private readonly router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
