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
  selector: 'app-wallet-reports-menu',
  imports: [CommonModule],
  templateUrl: './menu.component.html',
})
export class MenuComponent {
  menuOptions: MenuOption[] = [
    {
      title: 'Cartera por Cliente',
      icon: 'groups',
      route: '/financial/wallet/reports/client-portfolio',
      description: 'Consulta el estado de la cartera por cliente',
    },
    {
      title: 'Vencimiento por edades',
      icon: 'schedule',
      route: '/financial/wallet/reports/aging-portfolio',
      description: 'Consulta la cartera según sus vencimientos',
    },
  ];

  constructor(private readonly router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}