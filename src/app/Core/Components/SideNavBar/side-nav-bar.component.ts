import {
  Component,
  Output,
  EventEmitter,
  OnInit,
  HostListener,
} from '@angular/core';
import {
  trigger,
  style,
  animate,
  transition,
  keyframes,
} from '@angular/animations';
import { navbarData } from './nav-data';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SideNavToggle } from './SideNavToggle.interface';
import { INavbarData, fadeInOut } from './helper';
import { Router } from '@angular/router';
import { SublevelMenuComponent } from './sublevel-menu/sublevel-menu.component';
import { AuthService } from '../../auth/services/auth.service';

@Component({
  selector: 'app-side-nav-bar',
  imports: [CommonModule, RouterLink, RouterLinkActive, SublevelMenuComponent],
  templateUrl: './side-nav-bar.component.html',
  styleUrl: './side-nav-bar.component.css',
  animations: [
    fadeInOut,
    trigger('rotate', [
      transition(':enter', [
        animate(
          '500ms',
          keyframes([
            style({ transform: 'rotate(0deg)', offset: 0 }),
            style({ transform: 'rotate(2turn)', offset: 1 }),
          ])
        ),
      ]),
    ]),
  ],
})
export class SideNavBarComponent implements OnInit {
  @Output() onToggleSideNav: EventEmitter<SideNavToggle> = new EventEmitter();
  screenWidth = 0;
  /**
   * ATENCIÓN: el nombre es histórico y engaña. `collapsed = true` aplica la
   * clase `.sidenav-collapsed`, que en CSS mide 16.5625rem (MENÚ ABIERTO);
   * `collapsed = false` deja el riel de 5rem. O sea: true = abierto.
   */
  collapsed = false;
  /** true mientras el puntero está sobre el menú (sólo se usa en desktop). */
  hovered = false;
  /** true cuando el click en el logo de la U dejó el menú fijo abierto. */
  pinned = false;
  navData = navbarData;
  multiple: boolean = false;
  showOptions: boolean = false;

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.screenWidth = window.innerWidth;
    // Al cruzar breakpoints se pierden el hover y el "fijado" por click:
    // el menú vuelve a su estado base (riel en desktop, cerrado en móvil).
    this.hovered = false;
    this.pinned = false;
    this.collapsed = false;
    this.emitState();
  }

  constructor(public router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    this.screenWidth = window.innerWidth;
    // Móvil/tablet: entra abierto cuando se toca la hamburguesa.
    // Desktop: arranca como riel angosto; el hover es quien lo despliega.
    // No se emite nada acá: MainTemplate arranca con `collapsed = false`,
    // que es exactamente el mismo estado, así no se pisan en el primer CD.
    this.collapsed = this.screenWidth <= 1024;
    this.navData = this.filterNavByRoles(navbarData);
  }

  private get isDesktop(): boolean {
    return this.screenWidth > 1024;
  }

  /**
   * El estado del menú sube a MainTemplate para que el shell (header +
   * contenido) se corra el ancho del menú y no quede debajo.
   */
  private emitState(): void {
    this.onToggleSideNav.emit({
      collapsed: this.collapsed,
      screenWidth: this.screenWidth,
    });
  }

  /** Desktop: al entrar el puntero se despliega el menú. */
  onSidenavEnter(): void {
    this.hovered = true;
    if (!this.isDesktop) return;
    this.collapsed = this.hovered || this.pinned;
    this.emitState();
  }

  /** Desktop: al salir se pliega al riel, salvo que esté fijado por click. */
  onSidenavLeave(): void {
    this.hovered = false;
    if (!this.isDesktop) return;
    this.collapsed = this.pinned;
    this.emitState();
  }

  private filterNavByRoles(data: INavbarData[]): INavbarData[] {
    return data
      .map(item => ({
        ...item,
        items: item.items?.filter(sub =>
          !sub.roles || sub.roles.length === 0 ||
          sub.roles.some(r => this.auth.hasRole(r))
        )
      }))
      .filter(item =>
        !item.roles || item.roles.length === 0 ||
        item.roles.some(r => this.auth.hasRole(r))
      );
  }

  toggleOptions() {
    this.showOptions = !this.showOptions;
  }

  goBack() {
    this.router.navigate(['/enterprise/list']);
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    if (this.isDesktop) {
      // En desktop el hover manda: el click sólo fija el menú abierto (así
      // sobrevive a que el puntero se vaya) o lo suelta para volver al riel.
      this.pinned = this.collapsed;
    }
    this.showOptions = false;
    this.emitState();
  }

  closeSidenav(): void {
    this.collapsed = false;
    this.pinned = false;
    this.emitState();
  }

  handleClick(item: INavbarData): void {
    if (!this.multiple) {
      for (let modelItem of this.navData) {
        if (item !== modelItem && modelItem.expanded) {
          modelItem.expanded = false;
        }
      }
    }
    item.expanded = !item.expanded;
    this.goRoute(item);
  }

  goRoute(data: INavbarData) {
    return this.router.navigateByUrl(data.routeLink);
  }

  getActiveClass(data: INavbarData): string {
    return this.router.url.includes(data.routeLink) ? 'active' : '';
  }
}
