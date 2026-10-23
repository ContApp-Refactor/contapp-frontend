import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface InventoryOption {
  title: string;
  icon: string;
  route: string;
  description?: string;
}

@Component({
  selector: 'app-inventory-menu',
  imports: [CommonModule],
  templateUrl: './inventory-menu.component.html',
  styleUrl: './inventory-menu.component.css'
})
export class InventoryMenuComponent {
  inventoryOptions: InventoryOption[] = [
    {
      title: 'Unidades de Medida',
      icon: 'square_foot',
      route: '/gen-masters/inventory/measurement-units/list',
      description: 'Configuración de unidades de medida'
    },
    {
      title: 'Tipos de Productos',
      icon: 'dashboard',
      route: '/gen-masters/inventory/product-types/list',
      description: 'Configuración de tipos de productos'
    },
    {
      title: 'Categorías',
      icon: 'category_search',
      route: '/gen-masters/inventory/categories/list',
      description: 'Gestión de categorías de productos'
    },
    {
      title: 'Productos',
      icon: 'box',
      route: '/gen-masters/inventory/products/list',
      description: 'Gestión de productos del inventario'
    }
  ];

  constructor(private readonly router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
} 