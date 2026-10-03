import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../Header/header.component';
import { SideNavBarComponent } from '../SideNavBar/side-nav-bar.component';
import { FooterComponent } from '../Footer/footer.component';
import { CommonModule } from '@angular/common';
import { BreadCrumbComponent } from '../../../Shared/Components/bread-crumb/bread-crumb.component';

@Component({
  selector: 'app-main-template',
  imports: [
    RouterOutlet,
    HeaderComponent,
    SideNavBarComponent,
    FooterComponent,
    CommonModule,
    BreadCrumbComponent,
  ],
  templateUrl: './main-template.component.html',
  styleUrl: './main-template.component.css',
})
export class MainTemplateComponent implements OnInit, OnDestroy {
  title = 'ContApp';
  /**
   * Estado del menú: true = abierto. Arranca CERRADO en todos los cortes:
   * en desktop el SideNavBar nace como riel (false) y en móvil el menú ni
   * existe hasta que la hamburguesa lo abre.
   */
  collapsed = false;
  screenWidth = window.innerWidth;

  /** Deben calzar con .sidenav (5rem) y .sidenav-collapsed (16.5625rem). */
  private static readonly RAIL_WIDTH_PX = 80;
  private static readonly OPEN_WIDTH_PX = 265;

  constructor() {
    this.handleScreenSize();
  }

  ngOnInit() {
    this.handleScreenSize();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.screenWidth = window.innerWidth;
    this.handleScreenSize();
  }

  private handleScreenSize() {
    // Sólo se lleva el ancho. El estado del menú lo decide SideNavBar y sube
    // por onSidebarToggle: acá no se pisa, porque en desktop el riel y el
    // menú abierto conviven (riel = collapsed false = 80px).
    this.screenWidth = window.innerWidth;
  }

  /**
   * Px que el shell (header + contenido) se corre hacia la derecha. El menú
   * arranca en x=0, así que el shell empieza justo donde termina: header
   * "recortado" por el ancho del menú, esté abierto o cerrado, y el contenido
   * nunca queda tapado debajo. Vale igual en móvil y en desktop — por eso el
   * menú llega a y=0 en los dos y no queda por debajo del header.
   *
   * - Desktop cerrado: 80 (hay riel aunque el menú esté plegado).
   * - Móvil cerrado: 0 (el menú ni existe, no hay riel).
   * - Abierto (los dos): 265.
   */
  get shellOffset(): number {
    if (!this.collapsed) {
      return this.screenWidth > 1024
        ? MainTemplateComponent.RAIL_WIDTH_PX
        : 0;
    }
    return MainTemplateComponent.OPEN_WIDTH_PX;
  }

  /**
   * En móvil, cuando el menú está abierto el panel ya pinta su propia X de
   * cierre (`.btn-close` del logo-container): el botón del header sobraba y
   * se veían dos X sin motivo. Cerrado vuelve a aparecer, porque ahí es el
   * único que abre. En desktop el CSS del componente lo oculta igual
   * (`@media min-width:1024`), así que ahí éste no opina.
   */
  get showMenuToggle(): boolean {
    return !this.collapsed || this.screenWidth > 1024;
  }

  onSidebarToggle(data: { collapsed: boolean; screenWidth: number }) {
    this.collapsed = data.collapsed;
    this.screenWidth = data.screenWidth;
  }
}
