import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

// --- Importaciones Standalone y de PrimeNG ---
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { CategoryService } from '../../Services/category.service';
import { CategoryValidationMessagesService } from '../../Services/category-validation-messages.service';
import { Category } from '../../Models/Category';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { ChartAccountService } from '../../../../../GeneralMasters/AccountCatalogue/services/chart-account.service';
import { Account } from '../../../../../GeneralMasters/AccountCatalogue/models/ChartAccount';
import { TaxList } from '../../../../Taxes/models/Tax';
import { TaxService } from '../../../../Taxes/services/tax.service';
import { ProductTypeService } from '../../../ProductTypes/Services/product-type.service';
import { ProductType } from '../../../ProductTypes/Models/ProductType';

@Component({
  selector: 'app-category-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, // Esencial para formularios reactivos en componentes Standalone
    RouterModule,
    CardModule,
    InputTextModule,
    ButtonModule,
    SelectModule,
    MultiSelectModule,
    ToastModule
  ],
  templateUrl: './category-edit.component.html',
  styleUrl: './category-edit.component.css'
})
export class CategoryEditComponent implements OnInit {
  categoryId: string = '';
  category: Category = {} as Category;
  editForm: FormGroup;
  localStorageMethods = new LocalStorageMethods();
  entData: any = null;
  formSubmitAttempt = false;
  loading = false;
  
  // Propiedad para guardar datos originales
  private originalCategoryData!: Category;
  
  // Cuentas
  accounts: any[] = [];
  inventory: any[] = [];
  cost: any[] = [];
  sale: any[] = [];
  return: any[] = [];
  taxes: TaxList[] = [];
  productTypes: ProductType[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly categoryService: CategoryService,
    private readonly formBuilder: FormBuilder,
    private readonly router: Router,
    private readonly chartAccountService: ChartAccountService,
    private readonly taxService: TaxService,
    private readonly productTypeService: ProductTypeService,
    private readonly messageService: MessageService,
    public readonly categoryValidationMessagesService: CategoryValidationMessagesService
  ) {
    // Inicializa el formulario en el constructor para asegurar que esté disponible inmediatamente
    this.editForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.maxLength(255)]],
      taxes: [[], Validators.required],
      productType: [null, Validators.required],
      inventory: [null, Validators.required],
      cost: [null, Validators.required],
      sale: [null, Validators.required],
      return: [null, Validators.required],
      returnPurchase: [null, Validators.required]
    });
  }
  ngOnInit(): void {
    this.entData = this.localStorageMethods.getIdEnterprise();
    if (this.entData === null) {
      console.error("No se encontró el ID de la empresa. No se pueden cargar los datos del formulario.");
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo identificar la empresa. Vuelva a iniciar sesión.'
      });
    } else {
      this.route.params.subscribe(params => {
        this.categoryId = params['id'];
        this.loadInitialData();
      });
    }
  }

  loadInitialData(): void {
    const enterpriseId = this.entData?.id || this.localStorageMethods.getIdEnterprise();

    // Cargar cuentas, taxes y tipos de producto en paralelo, luego cargar detalles de categoría
    forkJoin([
      this.chartAccountService.getListAuxiliaryAccounts(enterpriseId),
      this.taxService.getActiveTaxes(this.entData),
      this.productTypeService.findActivate(enterpriseId)
    ]).subscribe(([accountsResult, taxesResult, productTypesResult]) => {
      // Procesar cuentas
      this.accounts = this.mapAccountToList(accountsResult);
      this.cost = this.accounts;
      this.inventory = this.accounts;
      this.sale = this.accounts;
      this.return = this.accounts;

      // Tipos de producto (PP7 HU2)
      this.productTypes = productTypesResult;

      // Procesar taxes
      this.taxes = taxesResult.map(tax => ({
        ...tax,
        displayText: `${tax.code} (${tax.interest}%)`
      }));

      // Ahora cargar los detalles de la categoría
      this.getCategoryDetails();
    });
  }

  getCategoryDetails(): void {
    const enterpriseId = this.entData?.id || this.localStorageMethods.getIdEnterprise();
    this.categoryService.getCategoryById(this.categoryId, enterpriseId).subscribe({
      next: (category: Category) => {

        this.category = category;
        // Guardar los datos originales para comparación
        this.originalCategoryData = { ...category };

        // Buscar las cuentas correspondientes por ID
        const inventoryAccount = this.accounts.find(acc => acc.id === category.inventoryId || acc.id === Number(category.inventoryId));
        const costAccount = this.accounts.find(acc => acc.id === category.costId || acc.id === Number(category.costId));
        const saleAccount = this.accounts.find(acc => acc.id === category.saleId || acc.id === Number(category.saleId));
        const returnAccount = this.accounts.find(acc => acc.id === category.returnId || acc.id === Number(category.returnId));
        const returnPurchaseAccount = this.accounts.find(acc => acc.id === category.returnPurchaseId || acc.id === Number(category.returnPurchaseId));
        const selectedProductType = this.productTypes.find(t => t.id === category.productTypeId || t.id === Number(category.productTypeId));

        // Buscar los taxes correspondientes por ID
        const selectedTaxes = Array.isArray(category.taxes)
          ? category.taxes.map(taxId => this.taxes.find(tax => tax.id === taxId || tax.id === Number(taxId))).filter(tax => tax != null)
          : [];

        // Pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
          this.editForm.patchValue({
            name: category.name,
            description: category.description,
            taxes: category.taxes || [], // Usar directamente los IDs, PrimeNG hará el matching
            productType: selectedProductType || null,
            inventory: inventoryAccount || null,
            cost: costAccount || null,
            sale: saleAccount || null,
            return: returnAccount || null,
            returnPurchase: returnPurchaseAccount || null
          });
        }, 100);
      },
      error: (error: any) => {
        console.error('Error obteniendo detalles de la categoría: ', error);
      }
    });
  }

    //cuentas
   // Cuentas
  getCuentas(): void {
    const enterpriseId = this.entData?.id || this.localStorageMethods.getIdEnterprise();
    this.chartAccountService.getListAuxiliaryAccounts(enterpriseId).subscribe({
      next: (data: any[]) => {
        this.accounts = this.mapAccountToList(data);
        this.cost = this.accounts;
        this.inventory = this.accounts;
        this.sale = this.accounts;
        this.return = this.accounts;
        
        // Ahora que las cuentas están cargadas, obtener los detalles de la categoría
        this.getCategoryDetails();
      },
      error: (error: any) => {
        console.error('Error al obtener las cuentas auxiliares en edición:', error);
      }
    });
  }

  getTaxes(): void {
    if (!this.entData) return;
    this.taxService.getActiveTaxes(this.entData).subscribe({
      next: (data) => {
        this.taxes = data.map(tax => ({
          ...tax,
          displayText: `${tax.code} (${tax.interest}%)`
        }));
      },
      error: (err) => console.error('Error al obtener los impuestos activos:', err)
    });
  }

mapAccountToList(data: Account[]): Account[] {
  let result: Account[] = [];

  function traverse(account: Account) {
      // Clonamos el objeto cuenta sin los hijos
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
get filteredAccounts() {
if (this.accounts) {
  return this.accounts.filter(account =>
    `${account.code} - ${account.description}`.toLowerCase()
  );
}
return [];
}

customSearchFn(term: string, item: any) {
term = term.toLowerCase();
return item.code.toLowerCase().includes(term) || item.description.toLowerCase().includes(term);
}


    validationsAll() {
      return {
        stringSearchCategory: [''],
      };
    }

  onSubmit(): void {
    this.formSubmitAttempt = true;
    if (this.editForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario Inválido',
        detail: 'Por favor, revise todos los campos requeridos.'
      });
      // Marcar todos los campos como "tocados" para mostrar los errores
      this.editForm.markAllAsTouched();
      return;
    }

    const formData = { ...this.editForm.value };
    
    // Verificar si hubo cambios
    const hasChanges = this.hasFormChanges(formData);

    if (!hasChanges) {
      this.messageService.add({
        severity: 'info',
        summary: 'Sin cambios',
        detail: 'No se han detectado cambios en la categoría.'
      });
      return;
    }
    
    // Los taxes ya vienen como IDs del form control
    const categoryData = {
      id: this.category.id,
      name: formData.name,
      description: formData.description,
      taxes: Array.isArray(formData.taxes) ? formData.taxes : [],
      productTypeId: formData.productType?.id || null,
      inventoryId: formData.inventory?.id || null,
      costId: formData.cost?.id || null,
      saleId: formData.sale?.id || null,
      returnId: formData.return?.id || null,
      returnPurchaseId: formData.returnPurchase?.id || null,
      enterpriseId: this.entData?.id || this.localStorageMethods.getIdEnterprise(),
      state: this.category.state
    };

    const enterpriseId = this.entData?.id || this.localStorageMethods.getIdEnterprise();
    this.categoryService.updateCategory(categoryData, enterpriseId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Actualización Exitosa',
          detail: 'Se ha actualizado la categoría con éxito.'
        });
        this.router.navigate(['/gen-masters/inventory/categories/list']); // Redirigir a la lista
      },
      error: (err: any) => {
        console.error('Error al actualizar la categoría:', err);

        // Verificar si el error específico de categoría en uso
        const errorCode = err?.error?.code || err?.code || '';
        if (errorCode === 'CATEGORY_IN_USE') {
          this.messageService.add({
            severity: 'info',
            summary: 'Información',
            detail: err?.error?.message || 'La categoría no se puede editar porque contiene productos con movimientos contables'
          });
          // Redirigir inmediatamente a la lista de categorías
          this.router.navigate(['/gen-masters/inventory/categories/list']);
        } else {
          if (err.error?.message) {
            this.messageService.add({
              severity: 'error',
              summary: 'Registro Duplicado',
              detail: err.error.message
            });
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Ha ocurrido un error al actualizar la categoría.'
            });
          }
        }
      }
    });
  }

  // Método para verificar si hubo cambios en el formulario
  private hasFormChanges(formData: any): boolean {
    if (!this.originalCategoryData) return false;

    // Comparar taxes (ya vienen como arrays de IDs)
    const formTaxIds = Array.isArray(formData.taxes)
      ? formData.taxes.slice().sort()
      : [];
    const originalTaxIds = Array.isArray(this.originalCategoryData.taxes)
      ? this.originalCategoryData.taxes.slice().sort()
      : [];

    return (
      formData.name !== this.originalCategoryData.name ||
      formData.description !== this.originalCategoryData.description ||
      JSON.stringify(formTaxIds) !== JSON.stringify(originalTaxIds) ||
      formData.inventory?.id !== this.originalCategoryData.inventoryId ||
      formData.cost?.id !== this.originalCategoryData.costId ||
      formData.sale?.id !== this.originalCategoryData.saleId ||
      formData.return?.id !== this.originalCategoryData.returnId ||
      (formData.productType?.id ?? null) !== (this.originalCategoryData.productTypeId ?? null) ||
      (formData.returnPurchase?.id ?? null) !== (this.originalCategoryData.returnPurchaseId ?? null)
    );
  }

  // Método público para verificar si hubo cambios (usado en el template)
  hasChanges(): boolean {
    // No permitir cambios si los datos originales no han cargado aún
    if (!this.originalCategoryData || !this.category || !this.accounts || !this.taxes) {
      console.log('hasChanges: Datos no cargados aún', {
        originalCategoryData: !!this.originalCategoryData,
        category: !!this.category,
        accounts: !!this.accounts,
        taxes: !!this.taxes
      });
      return false;
    }

    const formData = this.editForm.value;
    const hasChanges = this.hasFormChanges(formData);
    return hasChanges;
  }

  goBack(): void {
    this.router.navigate(['/gen-masters/inventory/categories/list']);
  }
}
