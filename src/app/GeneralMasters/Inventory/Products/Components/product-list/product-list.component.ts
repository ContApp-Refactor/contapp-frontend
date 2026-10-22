import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { safeReturnTo } from '../../../../../Billing/utils/return-trail';

import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';

import { Product, ProductList, Page } from '../../Models/Product';
import { ProductService } from '../../Services/product.service';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { TagModule } from 'primeng/tag';
import { InputIcon } from 'primeng/inputicon';
import { IconField } from 'primeng/iconfield';
import { TooltipModule } from 'primeng/tooltip';
import { CurrencyFormatPipe } from '../../Pipes/currency-format.pipe';
import { ProductsTemplateComponent } from '../products-template/products-template.component';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { PopoverModule } from 'primeng/popover';
import { HelpCenterService } from '../../../../../Shared/services/help-center.service';
import { TableEmptyMessageComponent } from '../../../../../Shared/Components/table-empty-message/table-empty-message.component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { AuthService } from '../../../../../Core/auth/services/auth.service';

// Interfaces para manejo de errores de importación
interface ImportError {
  rowNumber: number;
  columnNumber: number;
  columnName: string;
  fieldValue: any;
  errorCode: string;
  errorMessage: string;
  errorType: string;
}

@Component({
  selector: 'app-product-list',
  standalone: true,

  imports: [
    CommonModule,
    RouterModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    TagModule,
    InputIcon,
    IconField,
    TooltipModule,
    ToggleSwitchModule,
    FormsModule,
    CurrencyFormatPipe,
    ProductsTemplateComponent,
    RadioButtonModule,
    ProgressBarModule,
    PopoverModule,
    TableEmptyMessageComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent implements OnInit {
  localStorageMethods = new LocalStorageMethods();
  entData: Record<string, any> | null = null;
  productsPage: Page<ProductList> = {
    content: [],
    page: {
      size: 0,
      number: 0,
      totalElements: 0,
      totalPages: 0,
    },
  };
  products: ProductList[] = [];

  // Propiedades para paginación y búsqueda
  currentPage = 0;
  pageSize = 10;
  first = 0;
  sortField = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  searchTerm = '';

  isDetailsDialogVisible = false;
  selectedProduct: ProductList | null = null;
  showDetailView = false;
  showTemplateModal = false;
  loading = false;

  // Estado de exportación
  isExporting = false;

  // Estado de importación
  isImporting = false;

  // Propiedades para manejo asíncrono (importación/exportación)
  showProgressDialog = false;
  progressJobId: string | null = null;
  progressValue = 0;
  progressStatus = '';
  progressPhase = '';
  progressOperationType: 'import' | 'export' = 'import';
  private progressPollingInterval: any = null;
  importErrors: ImportError[] = [];
  totalErrors = 0;
  totalRecordsImported = 0;
  failedImportsCount = 0;
  successfulImports = 0;
  duplicatesSkipped = 0;
  showErrorModal = false;

  /**
   * Propiedades para el modal de exportación
   */
  exportStatusFilter: string | null = null;
  exportDialogMessage = '¿Qué tipo de productos desea exportar?';
  exportStatusOptions = [
    { label: 'Todos', value: null },
    { label: 'Activos', value: 'active' },
    { label: 'Inactivos', value: 'inactive' },
  ];

  // URL del centro de ayuda
  helpCenterUrl: string;

  ref: DynamicDialogRef | undefined; // Para manejar la referencia del modal de detalles
  canToggleState = false;

  constructor(
    private readonly productService: ProductService,
    private readonly router: Router,
    private readonly localstorageMethods: LocalStorageMethods,
    private readonly messageService: MessageService,
    private readonly confirmationService: ConfirmationService,
    private readonly helpCenterService: HelpCenterService,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
  ) {
    this.helpCenterUrl =
      this.helpCenterService.getHelpCenterUrl('configuracion');
  }

  // Ruta segura para "Volver a factura" (solo si llegó con ?returnTo=/billing/...)
  returnTo: string | null = null;

  goBackToInvoice(): void {
    if (this.returnTo) this.router.navigateByUrl(this.returnTo);
  }

  ngOnInit(): void {
    this.returnTo = safeReturnTo(this.route.snapshot.queryParamMap.get('returnTo'));
    this.entData = this.localStorageMethods.loadEnterpriseData();
    this.getProducts();
    const perms = this.authService.getCurrentUserPermissions();
    this.canToggleState = perms.includes('UM#CS');
  }

  getProducts(): void {
    const enterpriseId = this.localstorageMethods.getIdEnterprise();
    this.loading = true;
    this.productService
      .getProducts(
        enterpriseId,
        this.currentPage,
        this.pageSize,
        this.sortField,
        this.sortOrder,
        this.searchTerm || undefined,
      )
      .subscribe({
        next: (data: Page<ProductList>) => {
          this.productsPage = data;
          this.products = data.content;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al obtener los productos:', error);
          this.loading = false;
        },
      });
  }

  // Método para manejar cambios de página
  onPageChange(event: any): void {
    this.first = event.first;
    this.pageSize = event.rows;
    this.currentPage = Math.floor(this.first / this.pageSize);
    this.getProducts();
  }

  // Método para manejar búsqueda
  onSearchChange(): void {
    this.first = 0;
    this.currentPage = 0;
    this.getProducts();
  }

  // Método para manejar ordenamiento
  onSort(event: any): void {
    this.sortField = event.field;
    this.sortOrder = event.order === 1 ? 'asc' : 'desc';
    this.getProducts();
  }

  // Método para limpiar búsqueda
  clearSearch(): void {
    this.searchTerm = '';
    this.first = 0;
    this.currentPage = 0;
    this.getProducts();
  }

  // Método para alternar entre vista detallada y resumida
  toggleDetailView(): void {
    this.showDetailView = !this.showDetailView;
  }

  // Método para volver al menú de inventory
  goBack(): void {
    this.router.navigate(['/gen-masters/inventory']);
  }

  redirectTo(route: string): void {
    // navigateByUrl no soporta queryParamsHandling: se conservan los query params a mano
    const tree = this.router.parseUrl(route);
    tree.queryParams = { ...this.route.snapshot.queryParams, ...tree.queryParams };
    this.router.navigateByUrl(tree);
  }

  redirectToEdit(productId: number): void {
    this.router.navigate(
      ['/gen-masters/inventory/products/edit/', productId.toString()],
      { queryParamsHandling: 'preserve' },
    );
  }

  deleteProduct(productId: number): void {
    const enterpriseId = this.localstorageMethods.getIdEnterprise();
    if (!enterpriseId) return;

    const product = this.products.find((p) => p.id === productId);
    if (!product) return;

    this.confirmationService.confirm({
      header: 'Confirmar Eliminación',
      message: `¿Desea eliminar el producto "${product.name}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-secondary',
      defaultFocus: 'reject',
      closeOnEscape: true,
      accept: () => this.confirmDeleteProduct(product, enterpriseId),
    });
  }

  private confirmDeleteProduct(
    product: ProductList,
    enterpriseId: string,
  ): void {
    this.productService.deleteProduct(product.id, enterpriseId).subscribe({
      next: (data: Product) => {
        this.getProducts();
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'El producto se ha eliminado correctamente.',
        });
      },
      error: (error: any) => {
        console.error('Error al eliminar el producto: ', error);

        // Verificar si el error específico de producto en uso usando el código de error
        const errorCode = error?.error?.code || error?.code || '';
        if (errorCode === 'PRODUCT_IN_USE') {
          this.messageService.add({
            severity: 'info',
            summary: 'Información',
            detail:
              error?.error?.message ||
              'No se puede eliminar el producto porque tiene movimientos contables',
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Ha ocurrido un error al intentar eliminar el producto.',
          });
        }
      },
    });
  }

  openDetailsModal(product: ProductList): void {
    this.selectedProduct = product;
    this.isDetailsDialogVisible = true;
  }

  openTemplateModal(): void {
    if (!this.authService.requireAnyPermission(['P#ET'])) return;
    this.showTemplateModal = true;
  }

  closeTemplateModal(): void {
    this.showTemplateModal = false;
  }

  changeProductState(product: ProductList): void {
    const newState = product.state;
    const previousState = !newState; // El estado anterior es el opuesto al actual

    const enterpriseId = this.localstorageMethods.getIdEnterprise();
    this.productService.changeProductState(product.id, enterpriseId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: `Estado del producto "${product.name}" cambiado correctamente`,
        });
      },
      error: (error: any) => {
        product.state = previousState;
        console.error('Error al cambiar el estado del producto:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cambiar el estado del producto',
        });
      },
    });
  }

  /**
   * Muestra el modal de confirmación para exportar productos
   */
  showExportConfirmDialog() {
    if (!this.authService.requireAnyPermission(['P#E'])) return;
    this.exportStatusFilter = null; // "Todos" por defecto

    this.confirmationService.confirm({
      key: 'exportDialog',
      header: 'Exportar',
      acceptLabel: 'Exportar',
      acceptIcon: 'pi pi-download',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-secondary',
      accept: () => {
        const status =
          this.exportStatusFilter === 'active'
            ? true
            : this.exportStatusFilter === 'inactive'
              ? false
              : undefined;
        this.exportProducts(status);
      },
    });
  }

  /**
   * Exporta productos a formato Excel de forma asíncrona.
   */
  exportProducts(status: boolean | undefined): void {
    const entData = this.localStorageMethods.loadEnterpriseData();
    const entId = entData?.id || this.localstorageMethods.getIdEnterprise();
    const companyName = entData?.name || '';

    this.isExporting = true;
    this.progressOperationType = 'export';

    // Iniciar exportación asíncrona
    this.productService
      .exportProductsAsync(entId, companyName, status)
      .subscribe({
        next: (response) => {
          // Guardar el jobId y mostrar diálogo de progreso
          this.progressJobId = response.jobId;
          this.progressValue = 0;
          this.progressStatus = 'PROCESSING';
          this.progressPhase = 'Iniciando exportación...';
          this.showProgressDialog = true;

          // Iniciar polling cada 5 segundos
          this.startProgressPolling();
        },
        error: (error) => {
          this.isExporting = false;

          // Manejar error del backend
          let errorMessage = 'No se pudo iniciar la exportación';

          // Intentar extraer el mensaje del error
          if (error.error instanceof Blob) {
            // Si el error viene como Blob, leerlo
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const errorData = JSON.parse(reader.result as string);
                errorMessage = errorData.message || errorMessage;
                const isNoDataMessage =
                  this.isNoProductsAvailableMessage(errorMessage);

                this.messageService.add({
                  severity: isNoDataMessage ? 'info' : 'error',
                  summary: isNoDataMessage
                    ? 'Información'
                    : 'Error al Iniciar Exportación',
                  detail: isNoDataMessage
                    ? this.getNoProductsMessage(status)
                    : errorMessage,
                });
              } catch (e) {
                this.messageService.add({
                  severity: 'error',
                  summary: 'Error al Iniciar Exportación',
                  detail: errorMessage,
                });
              }
            };
            reader.onerror = () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error al Iniciar Exportación',
                detail: errorMessage,
              });
            };
            reader.readAsText(error.error);
          } else {
            // Error directo (JSON)
            errorMessage =
              error.error?.message || error.message || errorMessage;
            const isNoDataMessage =
              this.isNoProductsAvailableMessage(errorMessage);

            this.messageService.add({
              severity: isNoDataMessage ? 'info' : 'error',
              summary: isNoDataMessage
                ? 'Información'
                : 'Error al Iniciar Exportación',
              detail: isNoDataMessage
                ? this.getNoProductsMessage(status)
                : errorMessage,
            });
          }
        },
      });
  }

  /**
   * Verifica si el mensaje de error indica que no hay productos disponibles para exportar.
   */
  private isNoProductsAvailableMessage(message: string): boolean {
    const noProductsPatterns = [
      'no hay productos',
      'no existen productos',
      'no se encontraron productos',
      'no hay registros',
      'empty',
      'sin productos',
    ];

    return noProductsPatterns.some((pattern) =>
      message.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  /**
   * Retorna el mensaje informativo apropiado según el filtro de estado aplicado.
   */
  private getNoProductsMessage(status: boolean | undefined): string {
    switch (status) {
      case true:
        return 'No hay productos activos para exportar';
      case false:
        return 'No hay productos inactivos para exportar';
      case undefined:
      default:
        return 'No hay productos para exportar';
    }
  }

  /**
   * Procesa la respuesta HTTP para descargar el archivo.
   */
  private downloadFile(response: any): void {
    const blob = response.body;
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'productos.xlsx';

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
      );
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Maneja la selección de archivo para importar productos de forma asíncrona.
   * @param event Evento del selector de archivos.
   */
  onFileSelect(event: any): void {
    if (!this.authService.requireAnyPermission(['P#I'])) {
      event.target.value = '';
      return;
    }
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo manualmente
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Archivo inválido',
        detail: 'Por favor, selecciona un archivo EXCEL válido',
      });

      // Limpiar la selección del file upload
      event.target.value = '';
      return;
    }

    const entId = this.localstorageMethods.getIdEnterprise();
    this.isImporting = true;
    this.progressOperationType = 'import';

    // Iniciar importación asíncrona
    this.productService.importProductsAsync(entId, file).subscribe({
      next: (response) => {
        // Guardar el jobId y mostrar diálogo de progreso
        this.progressJobId = response.jobId;
        this.progressValue = 0;
        this.progressStatus = 'PROCESSING';
        this.progressPhase = 'Iniciando importación...';
        this.showProgressDialog = true;

        // Iniciar polling cada 5 segundos
        this.startProgressPolling();

        this.messageService.add({
          severity: 'info',
          summary: 'Importación iniciada',
          detail: 'La importación se está procesando.',
        });

        // Limpiar el input después de iniciar correctamente
        event.target.value = '';
      },
      error: (error) => {
        this.isImporting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error al Iniciar Importación',
          detail: error.error?.message || 'No se pudo iniciar la importación',
        });

        // Limpiar la selección del file upload
        event.target.value = '';
      },
    });
  }

  /**
   * Muestra el modal con los detalles de errores de importación.
   */
  private showImportErrorsModal(
    errors: ImportError[],
    fileName: string,
    totalRecords?: number,
    failedImports?: number,
    successfulImports?: number,
    duplicatesSkipped?: number,
  ): void {
    this.importErrors = errors;
    this.totalErrors = errors.length;
    this.totalRecordsImported = totalRecords || 0;
    this.failedImportsCount = failedImports || errors.length;
    this.successfulImports = successfulImports || 0;
    this.duplicatesSkipped = duplicatesSkipped || 0;
    this.showErrorModal = true;
  }

  /**
   * Cierra el modal de errores de importación.
   */
  closeErrorModal(): void {
    this.showErrorModal = false;
    this.importErrors = [];
    this.totalErrors = 0;
    this.totalRecordsImported = 0;
    this.failedImportsCount = 0;
    this.successfulImports = 0;
    this.duplicatesSkipped = 0;
  }

  /**
   * Inicia el polling para verificar el estado de la operación asíncrona cada 5 segundos.
   */
  private startProgressPolling(): void {
    // Limpiar cualquier polling anterior
    if (this.progressPollingInterval) {
      clearInterval(this.progressPollingInterval);
    }

    // Consultar inmediatamente y luego cada 5 segundos
    this.checkProgressStatus();
    this.progressPollingInterval = setInterval(() => {
      this.checkProgressStatus();
    }, 5000);
  }

  /**
   * Verifica el estado actual de la operación (importación o exportación).
   */
  private checkProgressStatus(): void {
    if (!this.progressJobId) return;

    const statusObservable =
      this.progressOperationType === 'import'
        ? this.productService.getImportStatus(this.progressJobId)
        : this.productService.getExportStatus(this.progressJobId);

    statusObservable.subscribe({
      next: (status) => {
        this.progressValue = status.progress || 0;
        this.progressStatus = status.status;

        // Actualizar mensaje de fase
        this.progressPhase = this.getProgressPhaseMessage(status);

        // Si la operación terminó (éxito, con errores o falla)
        if (
          status.status === 'COMPLETED' ||
          status.status === 'COMPLETED_WITH_ERRORS' ||
          status.status === 'FAILED'
        ) {
          this.stopProgressPolling();
          this.handleProgressCompletion(status);
        }
      },
      error: (error) => {
        const operationName =
          this.progressOperationType === 'import'
            ? 'importación'
            : 'exportación';
        this.stopProgressPolling();
        this.showProgressDialog = false;

        if (this.progressOperationType === 'import') {
          this.isImporting = false;
        } else {
          this.isExporting = false;
        }

        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `No se pudo consultar el estado de la ${operationName}`,
        });
      },
    });
  }

  /**
   * Detiene el polling de la operación asíncrona.
   */
  private stopProgressPolling(): void {
    if (this.progressPollingInterval) {
      clearInterval(this.progressPollingInterval);
      this.progressPollingInterval = null;
    }
  }

  /**
   * Obtiene el mensaje de fase actual según el estado y tipo de operación.
   */
  private getProgressPhaseMessage(status: any): string {
    if (this.progressOperationType === 'import') {
      return this.getImportPhaseMessage(status);
    } else {
      return this.getExportPhaseMessage(status);
    }
  }

  /**
   * Obtiene el mensaje de fase actual para importación.
   */
  private getImportPhaseMessage(status: any): string {
    if (status.progress === 100) {
      return 'Finalizando importación...';
    }

    if (status.progress >= 80) {
      return 'Guardando productos en la base de datos...';
    }

    if (status.progress >= 60) {
      return 'Validando relaciones y referencias...';
    }

    if (status.progress >= 40) {
      return 'Detectando duplicados...';
    }

    if (status.progress >= 20) {
      return 'Validando datos de productos...';
    }

    return 'Analizando archivo Excel...';
  }

  /**
   * Obtiene el mensaje de fase actual para exportación.
   */
  private getExportPhaseMessage(status: any): string {
    if (status.progress === 100) {
      return 'Finalizando exportación...';
    }

    if (status.progress >= 66) {
      return 'Almacenando archivo...';
    }

    if (status.progress >= 33) {
      return 'Generando archivo Excel...';
    }

    return 'Obteniendo datos de productos...';
  }

  /**
   * Maneja la finalización de la operación (importación o exportación).
   */
  private handleProgressCompletion(status: any): void {
    if (this.progressOperationType === 'import') {
      this.handleImportCompletion(status);
    } else {
      this.handleExportCompletion(status);
    }
  }

  /**
   * Maneja la finalización de la importación.
   */
  private handleImportCompletion(status: any): void {
    // Cerrar modal si está abierto
    this.showProgressDialog = false;
    this.isImporting = false;
    this.progressJobId = null;

    // Limpiar la selección del archivo
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    const {
      totalRecords,
      successfulImports,
      failedImports,
      duplicatesSkipped,
      errors,
    } = status;

    // Si hay errores, mostrar modal de errores (sin notificación adicional)
    if (errors && errors.length > 0) {
      this.showImportErrorsModal(
        errors,
        status.fileName || 'importacion.xlsx',
        totalRecords,
        failedImports,
        successfulImports,
        duplicatesSkipped,
      );

      // Recargar lista si hubo importaciones exitosas
      if (successfulImports > 0) {
        this.getProducts();
      }

      // No mostrar notificación cuando hay errores - el modal es suficiente
      return;
    }

    // Solo mostrar error general si el estado es FAILED sin errores detallados
    if (status.status === 'FAILED') {
      this.messageService.add({
        severity: 'error',
        summary: 'Importación Fallida',
        detail: status.errorMessage || 'La importación no pudo completarse',
        life: 8000,
      });
      return;
    }

    // Importación exitosa sin errores
    if (status.status === 'COMPLETED') {
      let detailMessage = `Total procesados: ${totalRecords || 0}\n`;
      detailMessage += `Exitosos: ${successfulImports || 0}`;
      if (duplicatesSkipped > 0) {
        detailMessage += `\nDuplicados omitidos: ${duplicatesSkipped}`;
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Importación Exitosa',
        detail: detailMessage,
        life: 8000,
      });
      this.getProducts();
    }
  }

  /**
   * Maneja la finalización de la exportación.
   */
  private handleExportCompletion(status: any): void {
    // Guardar el jobId antes de limpiarlo
    const jobId = this.progressJobId;

    // Cerrar modal si está abierto
    this.showProgressDialog = false;
    this.isExporting = false;
    this.progressJobId = null;

    if (status.status === 'FAILED') {
      const errorMessage =
        status.errorMessage || 'La exportación no pudo completarse';

      // Verificar si es un mensaje informativo (sin datos)
      const isNoDataMessage = this.isNoProductsAvailableMessage(errorMessage);

      this.messageService.add({
        severity: isNoDataMessage ? 'info' : 'error',
        summary: isNoDataMessage ? 'Información' : 'Exportación Fallida',
        detail: errorMessage,
        life: 8000,
      });
      return;
    }

    // Exportación exitosa - descargar archivo
    if (status.status === 'COMPLETED' && jobId) {
      this.productService.downloadExportFile(jobId).subscribe({
        next: (response) => {
          if (!response.body) {
            this.messageService.add({
              severity: 'error',
              summary: 'Error de Exportación',
              detail: 'No se recibió el archivo del servidor',
            });
            return;
          }

          this.downloadFile(response);

          let detailMessage = `Total de registros: ${status.totalRecords || 0}`;

          this.messageService.add({
            severity: 'success',
            summary: 'Exportación Exitosa',
            detail: detailMessage,
            life: 8000,
          });
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error de Descarga',
            detail: 'No se pudo descargar el archivo exportado',
          });
        },
      });
    }
  }

  /**
   * Maneja el cierre del modal de progreso.
   * El polling continúa en segundo plano.
   */
  onProgressDialogClose(): void {
    // Solo cerrar el modal, el polling continúa en segundo plano
    this.showProgressDialog = false;
  }

  /**
   * Exporta los errores de importación a un archivo Excel
   */
  exportImportErrors(): void {
    try {
      // Validar que existan errores para exportar
      if (!this.importErrors || this.importErrors.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin Errores',
          detail: 'No hay errores para exportar',
        });
        return;
      }

      // Crear el workbook y worksheet
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      const ws: XLSX.WorkSheet = {};

      // Información del encabezado
      const headerInfo = [
        ['ERRORES DE IMPORTACIÓN DE PRODUCTOS'],
        [''],
        [
          'Fecha de exportación:',
          new Date().toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }),
        ],
        ['Hora:', new Date().toLocaleTimeString('es-CO')],
        [''],
        ['RESUMEN DE IMPORTACIÓN'],
        ['Total procesados:', this.totalRecordsImported],
        ['Exitosos:', this.successfulImports],
        ['Fallidos:', this.failedImportsCount],
        ['Duplicados omitidos:', this.duplicatesSkipped],
        [''],
        ['DETALLE DE ERRORES'],
      ];

      // Agregar la información del encabezado
      XLSX.utils.sheet_add_aoa(ws, headerInfo, { origin: 'A1' });

      // Encabezados de la tabla
      const tableHeaders = [['Fila', 'Columna', 'Campo', 'Valor', 'Error']];

      // Agregar encabezados de la tabla
      XLSX.utils.sheet_add_aoa(ws, tableHeaders, { origin: 'A14' });

      // Preparar los datos de la tabla
      const tableData = this.importErrors.map((error) => [
        error.rowNumber,
        this.getExcelColumnLetter(error.columnNumber),
        error.columnName,
        error.fieldValue || '(vacío)',
        error.errorMessage,
      ]);

      // Agregar los datos de la tabla
      XLSX.utils.sheet_add_aoa(ws, tableData, { origin: 'A15' });

      // Establecer el rango de la hoja
      const totalRows = headerInfo.length + 2 + tableData.length;
      ws['!ref'] = `A1:E${totalRows}`;

      // Configurar anchos de columnas
      ws['!cols'] = [
        { wch: 8 }, // A - Fila
        { wch: 10 }, // B - Columna
        { wch: 25 }, // C - Campo
        { wch: 25 }, // D - Valor
        { wch: 60 }, // E - Error
      ];

      // Combinar celdas para el título
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }); // A1:E1 (Título)

      // Agregar el worksheet al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Errores Importación');

      // Generar el nombre del archivo con fecha local
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const timestamp = `${year}-${month}-${day}`;
      const fileName = `Errores_Importacion_Productos_${timestamp}.xlsx`;

      // Generar el archivo y descargarlo
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, fileName);

      // Cerrar el modal
      this.closeErrorModal();

      // Mostrar notificación de éxito
      this.messageService.add({
        severity: 'success',
        summary: 'Exportación exitosa',
        detail: 'El archivo se ha exportado correctamente.',
      });
    } catch (error) {
      console.error('Error al exportar errores:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error en Exportación',
        detail: 'Ocurrió un error al exportar los errores.',
      });
    }
  }

  /**
   * Convierte un número de columna a letra de Excel (1=A, 2=B, 27=AA, etc.)
   */
  getExcelColumnLetter(columnNumber: number): string {
    let columnLetter = '';
    let temp = columnNumber;

    while (temp > 0) {
      const remainder = (temp - 1) % 26;
      columnLetter = String.fromCharCode(65 + remainder) + columnLetter;
      temp = Math.floor((temp - 1) / 26);
    }

    return columnLetter;
  }
  onImportClick(fileInput: HTMLInputElement): void {
    if (!this.authService.requireAnyPermission(['P#I'])) return;
    fileInput.click();
  }
}
