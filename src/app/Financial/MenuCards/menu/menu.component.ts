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
  selector: 'app-financial-menu',
  imports: [CommonModule],
  templateUrl: './menu.component.html',
})
export class MenuComponent {
  menuOptions: MenuOption[] = [
    {
      title: 'Reportes',
      icon: 'assessment',
      route: '/financial/reports',
      description: 'Consulta de reportes financieros',
    },
    {
      title: 'Tesorería',
      icon: 'payments',
      route: '/financial/treasury',
      description: 'Gestión de operaciones de tesorería',
    },
    {
      title: 'Cartera',
      icon: 'account_balance_wallet',
      route: '/financial/wallet',
      description: 'Gestión y control de la cartera',
    },
  ];

  constructor(private readonly router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}