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
  selector: 'app-business-masters-menu',
  imports: [CommonModule],
  templateUrl: './menu.component.html',
})
export class MenuComponent {
  menuOptions: MenuOption[] = [
  {
    title: 'Inventario - Promedio Ponderado',
    icon: 'inventory_2',
    route: '/commercial/business-masters/kardex',
    description: 'Gestión y consulta del inventario mediante promedio ponderado',
  },
  {
    title: 'Inventario - PEPS',
    icon: 'inventory',
    route: '/commercial/business-masters/peps',
    description: 'Gestión y consulta del inventario mediante el método PEPS',
  },
];

  constructor(private readonly router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
