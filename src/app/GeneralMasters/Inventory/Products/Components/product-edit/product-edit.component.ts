import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';

import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { ProductType } from '../../../ProductTypes/Models/ProductType';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { ProductService } from '../../Services/product.service';
import { UnitOfMeasureService } from '../../../MeasurementUnits/Services/unit-of-measure.service';
import { CategoryService } from '../../../Category/Services/category.service';
import { ProductTypeService } from '../../../ProductTypes/Services/product-type.service';
import { Product } from '../../Models/Product';
import { ValidationMessagesService } from '../../Services/validation-messages.service';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    InputTextModule,
    SelectModule,
    ButtonModule,
    InputNumberModule,
    ToastModule,
  ],
  templateUrl: './product-edit.component.html',
  styleUrls: ['./product-edit.component.css'],
})
export class ProductEditComponent implements OnInit {
  productForm: FormGroup;
  unitOfMeasures: any[] = [];
  categories: any[] = [];
  productTypes: ProductType[] = [];
  currentProductId!: number;
  isLoading = true;
  formSubmitAttempt = false;
  
  userModifiedFields = {
    productTypeId: false,
    unitOfMeasureId: false,
    categoryId: false
  };

  private originalProductData!: Product;

  localStorageMethods = new LocalStorageMethods();
  entData: string = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly productService: ProductService,
    private readonly unitOfMeasureService: UnitOfMeasureService,
    private readonly categoryService: CategoryService,
    private readonly productTypeService: ProductTypeService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly messageService: MessageService,
    private readonly validationMessagesService: ValidationMessagesService
  ) {
    this.productForm = this.formBuilder.group({
      name: ['', Validators.required], 
      description: ['', Validators.required],
      reference: ['', Validators.required],
      presentation: ['', Validators.required], // Campo opcional
      quantity: [0],
      cost: [0],
      unitOfMeasureId: [null, Validators.required],
      categoryId: [null, Validators.required],
      productTypeId: [null, Validators.required],
      state: [true], // Nuevo campo
    });
  }

  ngOnInit(): void {
  
    this.entData = this.localStorageMethods.getIdEnterprise();
    this.loadDropdownData();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.currentProductId = Number.parseInt(id, 10);
      this.loadProductData(this.currentProductId);
    } else {
      console.error('ID de producto no encontrado en la ruta');
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se encontró un ID de producto para editar.'
      });
      this.router.navigate(['/gen-masters/inventory/products/list'], { queryParamsHandling: 'preserve' });
    }
  }

  // Método para obtener mensajes de validación
  getValidationMessage(fieldName: string): string {
    const control = this.productForm.get(fieldName);
    return this.validationMessagesService.getFieldErrorMessage(control, fieldName) || '';
  }

  loadDropdownData(): void {
    if (!this.entData) return;
    this.unitOfMeasureService.findActivate(this.entData).subscribe(data => this.unitOfMeasures = data);
    this.categoryService.findActivate(this.entData).subscribe(data => this.categories = data);
    this.productTypeService.findActivate(this.entData).subscribe((data: ProductType[]) => this.productTypes = data);
  }

  loadProductData(id: number): void {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    this.productService.getProductById(id, enterpriseId).subscribe({
      next: (product: Product) => {
        // Convertir valores numéricos explícitamente
        this.originalProductData = {
          ...product,
          quantity: Number(product.quantity),
          cost: Number(product.cost),
          unitOfMeasureId: Number(product.unitOfMeasureId),
          categoryId: Number(product.categoryId),
          productTypeId: Number(product.productTypeId)
        };
        
        const formData: any = { ...this.originalProductData };        
        
        // Usar los datos modificados para el formulario
        this.productForm.patchValue(formData);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar el producto:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los datos del producto.'
        });
        this.isLoading = false;
        this.router.navigate(['/gen-masters/inventory/products/list'], { queryParamsHandling: 'preserve' }); 
      }
    });
  }

  onSubmit(): void {
    this.formSubmitAttempt = true;
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const hasChanges = this.hasFormChanges();

    if (!hasChanges) {
      this.messageService.add({
        severity: 'info',
        summary: 'Sin cambios',
        detail: 'No se han detectado cambios en el producto.'
      });
      return;
    }

    const formData = { ...this.productForm.value };
    
    // Mapear los datos correctamente para el backend
    const productData = {
      name: formData.name,
      description: formData.description,
      reference: formData.reference,
      presentation: formData.presentation,
      quantity: Number(formData.quantity),
      cost: Number(formData.cost),
      unitOfMeasureId: formData.unitOfMeasureId, 
      categoryId: formData.categoryId, 
      productTypeId: formData.productTypeId, 
      state: formData.state,
      enterpriseId: this.originalProductData.enterpriseId
    };
    
    const payload = {
      ...this.originalProductData,
      ...productData
    };
    this.productService.updateProduct(this.currentProductId, payload as any).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Actualización Exitosa',
          detail: 'El producto ha sido actualizado con éxito.'
        });
        this.router.navigate(['/gen-masters/inventory/products/list'], { queryParamsHandling: 'preserve' });
      },
      error: (err) => {
        console.error('Error al actualizar el producto:', err);

        // Verificar si el error específico de producto en uso
        const errorCode = err?.error?.code || err?.code || '';
        if (errorCode === 'PRODUCT_IN_USE') {
          this.messageService.add({
            severity: 'info',
            summary: 'Información',
            detail: err?.error?.message || 'No se puede editar el producto porque tiene movimientos contables'
          });
          // Redirigir inmediatamente a la lista de productos
          this.router.navigate(['/gen-masters/inventory/products/list'], { queryParamsHandling: 'preserve' });
        } else {
          const errorMessage = err?.error?.message || 'Ha ocurrido un problema al actualizar el producto.';
          let summary = 'Error';
          if (errorMessage.includes('Ya existe') || errorMessage.includes('duplicado') || errorMessage.includes('Duplicate')) {
            summary = 'Registro Duplicado';
          }
          this.messageService.add({
            severity: 'error',
            summary: summary,
            detail: errorMessage
          });
        }
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/gen-masters/inventory/products/list'], { queryParamsHandling: 'preserve' }); 
  }

  private hasFormChanges(): boolean {
    if (!this.originalProductData) return false;
    const formData = this.productForm.value;
    
    const compareValues = (val1: any, val2: any) => {
      if (typeof val1 === 'number' || typeof val2 === 'number') {
        return Number(val1) !== Number(val2);
      }
      return val1 !== val2;
    };

    const changes = {
      name: compareValues(formData.name, this.originalProductData.name),
      description: compareValues(formData.description, this.originalProductData.description),
      reference: compareValues(formData.reference, this.originalProductData.reference),
      presentation: compareValues(formData.presentation, this.originalProductData.presentation),
      quantity: compareValues(formData.quantity, this.originalProductData.quantity),
      cost: compareValues(formData.cost, this.originalProductData.cost),
      unitOfMeasureId: compareValues(formData.unitOfMeasureId, this.originalProductData.unitOfMeasureId),
      categoryId: compareValues(formData.categoryId, this.originalProductData.categoryId),
      productTypeId: compareValues(formData.productTypeId, this.originalProductData.productTypeId)
    };

    return Object.values(changes).includes(true);
  }

  get hasChanges(): boolean {
    if (!this.originalProductData) return false;
    return this.hasFormChanges();
  }

  onFieldChange(fieldName: keyof typeof this.userModifiedFields): void {
    const fieldValue = this.productForm.get(fieldName)?.value;
    this.userModifiedFields[fieldName] = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
  }

  shouldShowClear(fieldName: keyof typeof this.userModifiedFields): boolean {
    const fieldValue = this.productForm.get(fieldName)?.value;
    const hasValue = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    const wasModified = this.userModifiedFields[fieldName];
    return hasValue && wasModified;
  }

  private arraysEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }
}