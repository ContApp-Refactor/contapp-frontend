import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'; // agrega OnInit
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { MenuItem } from 'primeng/api';
import { NavigationEnd, Router, Event } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { InvoicePortfolioService } from '../../../Financial/Wallet/PortfolioManagement/Service/invoice-portfolio.service';
import { LocalStorageMethods } from '../../../Shared/Methods/local-storage.method';
import { HelpCenterService } from '../../../Shared/services/help-center.service';
import { filter, Subscription, Subject, debounceTime } from 'rxjs';
import {
  ExternalNotification,
  NotificationBellComponent,
} from '../../../Shared/Components/notification-bell/notification-bell.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonModule, MenuModule, OverlayPanelModule, NotificationBellComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  /**
   * Muestra el botón que abre/cierra el menú lateral.
   * Sólo lo enciende el layout principal (MainTemplate): las páginas que
   * renderizan <app-header> por su cuenta no tienen menú lateral.
   */
  @Input() showMenuToggle = false;

  /** Estado actual del menú lateral, para alternar el ícono del botón. */
  @Input() menuOpen = false;

  /** Emite cuando se hace click en el botón del menú lateral. */
  @Output() menuToggle = new EventEmitter<void>();

  applicationName = 'ContApp';
  companyName = 'Nombre de la empresa';
  userName = 'Nombre completo del usuario';
  userRole = 'Rol del usuario';
  helpCenterUrl: string;

  // inicializa vacío; lo llenamos en ngOnInit
  userMenuItems: MenuItem[] = [];

  //Variables para notificaciones
  alertsCount: number = 0;
  lastCheckDate: Date = new Date();
  showNotifications: boolean = false;
  externalNotifications: ExternalNotification[] = [];
  private routerSubscription: Subscription | undefined;
  private navigationEndSubject = new Subject<void>();

  constructor(
    private router: Router,
    private auth: AuthService,
    private invoiceService: InvoicePortfolioService,
    private localStorageMethods: LocalStorageMethods,
    private helpCenterService: HelpCenterService
  ) {
    this.helpCenterUrl = this.helpCenterService.getHelpCenterUrl('');
    this.routerSubscription = this.router.events
      .pipe(
        filter(
          (event: Event): event is NavigationEnd =>
            event instanceof NavigationEnd
        )
      )
      .subscribe(() => {
        this.navigationEndSubject.next();
      });

    this.navigationEndSubject
      .pipe(debounceTime(1000))
      .subscribe(() => this.checkEnterpriseStatus());
  }

  ngOnInit(): void {
    this.userName =
      this.auth.returnUserInfo()?.firstName +
        ' ' +
        this.auth.returnUserInfo()?.lastName || 'Usuario sin Definir';
    this.userRole = this.auth.concatRoles() || 'Rol sin Definir';
    this.userMenuItems = [
      {
        label: 'Perfil',
        icon: 'pi pi-user',
        command: () => this.viewProfile(),
      },
      {
        label: 'Configuración',
        icon: 'pi pi-cog',
        visible: this.auth.hasRole('Administrador'), //  ya puedes usar this.auth
        command: () => this.openSettings(),
      },
      { separator: true },
      {
        label: 'Cerrar Sesión',
        icon: 'pi pi-sign-out',
        command: () => this.logout(),
      },
    ];
    this.checkEnterpriseStatus();
  }

  ngOnDestroy(): void {
    // Limpiar suscripción para evitar fugas de memoria
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  viewProfile(): void {
    console.log('Ver perfil del usuario');
  }
  openSettings(): void {
    this.router.navigate(['/configuration']);
  }
  logout(): void {
    this.auth.logout().subscribe();
  }

  openHelpCenter(): void {
    window.open(this.helpCenterUrl, '_blank');
  }

  checkEnterpriseStatus() {
    // 1. VALIDACIÓN POR RUTA (Lo nuevo)
    const currentUrl = this.router.url;

    const blacklistedRoutes = [
      '/enterprise/list',
      '/enterprise/create',
      '/auth/login',
      '/auth/register',
    ];

    const isExcluded = blacklistedRoutes.some((route) =>
      currentUrl.includes(route)
    );

    if (isExcluded) {
      this.showNotifications = false;
      this.alertsCount = 0;
      this.companyName = '';
      this.refreshExternalNotifications();
      return;
    }

    const currentId = this.localStorageMethods.getIdEnterprise();
    const enterpriseData = this.localStorageMethods.loadEnterpriseData();

    if (currentId && currentId.trim() !== '') {
      this.showNotifications = true;
      this.companyName = enterpriseData?.name || 'Empresa';
      this.loadNotifications(currentId);
    } else {
      this.showNotifications = false;
      this.alertsCount = 0;
      this.companyName = '';
      this.refreshExternalNotifications();
    }
  }

  loadNotifications(enterpriseId: string) {
    this.invoiceService.getExpiringInvoices(enterpriseId).subscribe({
      next: (invoices) => {
        this.alertsCount = invoices.length;
        this.lastCheckDate = new Date();
        this.refreshExternalNotifications();
      },
      error: (err) => console.error('Error cargando alertas', err),
    });
  }

  private refreshExternalNotifications(): void {
    if (this.alertsCount > 0) {
      this.externalNotifications = [
        {
          id: 'expiring-invoices',
          title: 'Facturas próximas a vencer',
          message: `Tienes <strong>${this.alertsCount}</strong> facturas pendientes que requieren atención urgente.`,
          date: this.lastCheckDate,
          severity: 'danger',
          icon: 'pi pi-exclamation-circle',
        },
      ];
    } else {
      this.externalNotifications = [];
    }
  }

  navigateToAlertsDetail(): void {
    this.router.navigate(['/financial/wallet/invoices/expiring']);
  }
}
