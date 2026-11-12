import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../../models/document-kind';
import { kindFromRoute } from '../../utils/route-kind';
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
  private readonly route = inject(ActivatedRoute, { optional: true });

  // Hub de compra o de venta según `data.kind` de la ruta: mismo diseño, opciones y rutas del tipo
  readonly kind: DocumentKind = kindFromRoute(this.route);
  readonly cfg = DOCUMENT_KIND_CONFIG[this.kind];

  // "Continuar factura pendiente" ya no es un botón: los borradores se listan en la tabla de esta misma pantalla
  options: BillingOption[] = [
    { title: this.cfg.newButtonLabel, icon: this.kind === 'SALE' ? 'pi pi-dollar' : 'pi pi-shopping-cart', route: `${this.cfg.basePath}/new`, primary: true },
    { title: 'Ver facturas', icon: 'pi pi-list', route: `${this.cfg.basePath}/list`, primary: false },
    { title: 'Devoluciones', icon: 'pi pi-replay', route: `${this.cfg.basePath}/returns`, primary: false },
  ];

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
