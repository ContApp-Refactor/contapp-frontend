import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { InputIcon } from 'primeng/inputicon';
import { IconField } from 'primeng/iconfield';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';

import { Category } from '../../Models/Category';
import { CategoryService } from '../../Services/category.service';
import { CategoryValidationMessagesService } from '../../Services/category-validation-messages.service';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { ChartAccountService } from '../../../../../GeneralMasters/AccountCatalogue/services/chart-account.service';
import { Account } from '../../../../../GeneralMasters/AccountCatalogue/models/ChartAccount';
import { TaxService } from '../../../../Taxes/services/tax.service';
import { ProductTypeService } from '../../../ProductTypes/Services/product-type.service';
import { ProductType } from '../../../ProductTypes/Models/ProductType';
import { TableEmptyMessageComponent } from '../../../../../Shared/Components/table-empty-message/table-empty-message.component';
import { AuthService } from '../../../../../Core/auth/services/auth.service';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    CardModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule,
    InputIcon,
    IconField,
    ToggleSwitchModule,
    TagModule,
    TableEmptyMessageComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.css',
})
export class CategoryListComponent implements OnInit {
  localStorageMethods = new LocalStorageMethods();
  entData: string | null = null;
  categories: Category[] = [];
  accounts: any[] = [];
  taxes: any[] = [];
  productTypes: ProductType[] = [];
  loading: boolean = false;

  totalRecords: number = 0;
  currentPage: number = 0;
  currentSize: number = 10;
  first: number = 0;
  currentSortField: string = 'name';
  currentSortOrder: string = 'asc';
  searchTerm: string = '';
  canToggleState = false;

  constructor(
    private readonly categoryService: CategoryService,
    private readonly router: Router,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    private readonly chartAccountService: ChartAccountService,
    private readonly taxService: TaxService,
    private readonly productTypeService: ProductTypeService,
    public readonly categoryValidationMessagesService: CategoryValidationMessagesService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.entData = this.localStorageMethods.getIdEnterprise();
    const perms = this.authService.getCurrentUserPermissions();
    this.canToggleState = perms.includes('C#CS');
    if (this.entData) {
      this.loadCategoriesLazy({
        first: 0,
        rows: this.currentSize,
        sortField: this.currentSortField,
        sortOrder: this.currentSortOrder === 'asc' ? 1 : -1,
      });
      this.getCuentas();
      this.getTaxes();
      this.getProductTypes();
    }
  }

  private getEnterpriseId(): string {
    return this.entData || '';
  }

  getProductTypes(): void {
    const enterpriseId = this.getEnterpriseId();
    if (!enterpriseId) return;
    this.productTypeService.findActivate(enterpriseId).subscribe({
      next: (types) => {
        this.productTypes = types;
      },
      error: (error: any) => {
        console.error('Error al obtener los tipos de producto:', error);
        this.productTypes = [];
      },
    });
  }

  getProductTypeName(id: number | string | null | undefined): string {
    if (id === null || id === undefined || id === 0 || id === '0' || id === '') {
      return 'No asignado';
    }
    const type = this.productTypes.find(
      (t) => t.id === Number(id) || t.id === id
    );
    return type ? type.name : 'No asignado';
  }

  loadCategoriesLazy(event: any): void {
    const enterpriseId = this.getEnterpriseId();
    if (!enterpriseId) return;

    this.loading = true;
    this.first = event.first;
    this.currentPage = Math.floor(event.first / event.rows);
    this.currentSize = event.rows;

    if (event.sortField) {
      this.currentSortField = event.sortField;
      this.currentSortOrder = event.sortOrder === 1 ? 'asc' : 'desc';
    }

    this.categoryService
      .findAll(
        enterpriseId,
        this.currentPage,
        this.currentSize,
        this.currentSortField,
        this.currentSortOrder,
        this.searchTerm,
      )
      .subscribe({
        next: (page: any) => {
          this.categories = page.content || [];
          this.totalRecords = page.page?.totalElements || 0;
          this.loading = false;
        },
        error: (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las categorías.',
          });
          this.loading = false;
        },
      });
  }

  reloadCurrentPage(): void {
    const enterpriseId = this.getEnterpriseId();
    if (!enterpriseId) return;

    this.loading = true;
    this.categoryService
      .findAll(
        enterpriseId,
        this.currentPage,
        this.currentSize,
        this.currentSortField,
        this.currentSortOrder,
        this.searchTerm,
      )
      .subscribe({
        next: (page: any) => {
          this.categories = page.content || [];
          this.totalRecords = page.page?.totalElements || 0;
          this.loading = false;
        },
        error: (error: any) => {
          this.loading = false;
        },
      });
  }

  onSearchChange(): void {
    this.first = 0;
    this.currentPage = 0;
    this.loadCategoriesLazy({
      first: 0,
      rows: this.currentSize,
      sortField: this.currentSortField,
      sortOrder: this.currentSortOrder === 'asc' ? 1 : -1,
    });
  }

  getCuentas(): void {
    const enterpriseId = this.getEnterpriseId();
    this.chartAccountService.getListAccounts(enterpriseId).subscribe({
      next: (data: any[]) => {
        this.accounts = this.mapAccountToList(data);
      },
      error: (error: any) => {
        console.error('Error al obtener las cuentas:', error);
        this.accounts = [];
      },
    });
  }

  getTaxes(): void {
    const enterpriseId = this.getEnterpriseId();
    this.taxService.findAll(enterpriseId).subscribe({
      next: (page: any) => {
        this.taxes = page.content || [];
      },
      error: (error: any) => {
        console.error('Error al obtener los impuestos:', error);
        this.taxes = [];
      },
    });
  }

  mapAccountToList(data: Account[]): Account[] {
    let result: Account[] = [];

    function traverse(account: Account) {
      let { children, ...accountWithoutChildren } = account;
      result.push(accountWithoutChildren as Account);

      // Llamamos recursivamente para cada hijo
      if (children && children.length > 0) {
        for (const child of children) {
          traverse(child);
        }
      }
    }

    for (const account of data) {
      traverse(account);
    }
    return result;
  }

  getCategoryName(id: number | string | null | undefined): string {
    // Si el ID es null, undefined, o 0, retornar un mensaje apropiado
    if (
      id === null ||
      id === undefined ||
      id === 0 ||
      id === '0' ||
      id === ''
    ) {
      return 'No asignado';
    }

    // Si las cuentas aún no están cargadas, mostrar mensaje de carga
    if (this.accounts.length === 0) {
      return 'Cargando...';
    }

    // Convertir a número si es string, manejando posibles errores
    let numericId: number;
    if (typeof id === 'string') {
      numericId = Number.parseInt(id, 10);
      if (Number.isNaN(numericId)) {
        return 'ID inválido';
      }
    } else {
      numericId = id;
    }

    // Verificar si el ID existe en la lista de cuentas
    const account = this.accounts.find((cuenta) => {
      return cuenta.id === numericId || cuenta.id === id;
    });

    if (!account) {
      return `N/A`;
    }

    const code = account.code || '';
    const description = account.description || 'Sin descripción';

    return code ? `${code} - ${description}` : description;
  }

  getTaxNames(taxIds: number[] | undefined): string {
    if (!taxIds || taxIds.length === 0) {
      return '';
    }

    if (this.taxes.length === 0) {
      return taxIds.join(', '); // Mostrar IDs si no se cargaron los nombres
    }

    const taxNames = taxIds.map((id) => {
      const tax = this.taxes.find((t) => t.id === id);
      return tax ? `${tax.code} (${tax.interest}%)` : `ID ${id}`;
    });

    return taxNames.join(', ');
  }

  redirectToCreate(): void {
    this.router.navigate(['/gen-masters/inventory/categories/create']);
  }

  redirectToEdit(categoryId: string): void {
    this.router.navigate([
      '/gen-masters/inventory/categories/edit/',
      categoryId,
    ]);
  }

  goBack(): void {
    this.router.navigate(['/gen-masters/inventory']);
  }

  deleteCategory(category: Category): void {
    const enterpriseId = this.getEnterpriseId();
    if (!enterpriseId) return;
    if (!this.authService.requireAnyPermission(['C#D'])) return;

    this.confirmationService.confirm({
      message: `¿Desea eliminar la categoría "${category.name}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.categoryService
          .deleteCategory(category.id!.toString(), enterpriseId)
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Eliminada',
                detail: 'Categoría eliminada correctamente',
              });
              this.reloadCurrentPage();
            },
            error: (error: any) => {
              console.error('Error al eliminar la categoría:', error);
              this.messageService.add({
                severity: 'info',
                summary: 'Información',
                detail: `No se puede eliminar la categoria "${category.name}" porque está siendo utilizada por uno o más productos.`,
              });
            },
          });
      },
    });
  }

  // Método para cambiar el estado de la categoría
  changeCategoryState(category: Category): void {
    if (!category.id) {
      return;
    }

    const enterpriseId = this.getEnterpriseId();
    if (!enterpriseId) return;

    const newState = category.state;
    const previousState = !newState;

    this.categoryService
      .changeCategoryState(category.id, enterpriseId)
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: `Estado de la categoría "${category.name}" cambiado correctamente`,
          });
        },
        error: (error: any) => {
          // Revertir el cambio si hay error
          category.state = previousState;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cambiar el estado de la categoría',
          });
        },
      });
  }
}
