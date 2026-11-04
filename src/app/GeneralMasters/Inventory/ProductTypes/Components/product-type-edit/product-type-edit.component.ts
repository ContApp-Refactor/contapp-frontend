import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';

import { ProductType } from '../../Models/ProductType';
import { ProductTypeService } from '../../Services/product-type.service';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { ProductTypeValidationMessagesService } from '../../Services/product-type-validation-messages.service';

@Component({
  selector: 'app-product-type-edit',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    InputTextModule,
    TextareaModule,
    CheckboxModule,
    ButtonModule,
    ReactiveFormsModule,
    ToastModule
  ],
  templateUrl: './product-type-edit.component.html',
})
export class ProductTypeEditComponent implements OnInit {
  productTypeForm!: FormGroup;
  productTypeId: string | null = null;
  localStorageMethods = new LocalStorageMethods();
  entData: string | null = null;
  currentProductType: ProductType | null = null;
  private originalProductTypeData!: ProductType;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly formBuilder: FormBuilder,
    private readonly productTypeService: ProductTypeService,
    private readonly router: Router,
    private readonly messageService: MessageService,
    private readonly validationMessagesService: ProductTypeValidationMessagesService
  ) {}

  ngOnInit(): void {
    this.productTypeForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.maxLength(255)]],
      // Clasificación HU1: los valores reales se cargan en patchValue al obtener el tipo
      sellable: [true],
      purchasable: [true],
      inventoryable: [false]
    });

    this.entData = this.localStorageMethods.getIdEnterprise();
    this.productTypeId = this.route.snapshot.paramMap.get('id');
    
    if (this.productTypeId) {
      this.loadProductType();
    }
  }

  loadProductType(): void {
    if (this.productTypeId && this.entData) {
      this.productTypeService.getProductTypeById(this.productTypeId, this.entData).subscribe({
        next: (productType) => {
          this.currentProductType = productType;
          this.originalProductTypeData = { ...productType };
          this.productTypeForm.patchValue({
            name: productType.name,
            description: productType.description,
            sellable: productType.sellable,
            purchasable: productType.purchasable,
            inventoryable: productType.inventoryable
          });
        },
        error: (error: any) => {
          console.error('Error al cargar el tipo de producto:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar el tipo de producto'
          });
        }
      });
    }
  }

  onSubmit(): void {
    if (this.productTypeForm.valid && this.currentProductType && this.entData) {
      // Verificar si hubo cambios
      const hasChanges = this.hasFormChanges();

      if (!hasChanges) {
        this.messageService.add({
          severity: 'info',
          summary: 'Sin cambios',
          detail: 'No se han detectado cambios en el tipo de producto.'
        });
        return;
      }

      const updatedProductType: ProductType = {
        ...this.currentProductType,
        name: this.productTypeForm.value.name,
        description: this.productTypeForm.value.description,
        sellable: this.productTypeForm.value.sellable,
        purchasable: this.productTypeForm.value.purchasable,
        inventoryable: this.productTypeForm.value.inventoryable,
        enterpriseId: this.entData
      };

      this.productTypeService.updateProductType(updatedProductType).subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Actualización Exitosa',
            detail: 'Tipo de producto actualizado correctamente'
          });
          
          this.router.navigate(['/gen-masters/inventory/product-types/list']);
        },
        error: (error) => {
          // Verificar si el error específico de tipo de producto en uso
          const errorCode = error?.error?.code || error?.code || '';
          if (errorCode === 'PRODUCT_TYPE_IN_USE') {
            this.messageService.add({
              severity: 'info',
              summary: 'Información',
              detail: error?.error?.message || 'El tipo de producto no se puede editar porque contiene productos con movimientos contables'
            });
            // Redirigir inmediatamente a la lista de tipos de producto
            this.router.navigate(['/gen-masters/inventory/product-types/list']);
          } else {
            const message = error.error?.message || 'Ha ocurrido un error al actualizar el tipo de producto. Por favor, inténtelo de nuevo.';
            let summary = 'Error';
            if (message.includes('Ya existe')) {
              summary = 'Registro Duplicado';
            }
            this.messageService.add({
              severity: 'error',
              summary: summary,
              detail: message
            });
          }
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }



  private markFormGroupTouched(): void {
    for (const key of Object.keys(this.productTypeForm.controls)) {
      const control = this.productTypeForm.get(key);
      control?.markAsTouched();
    }
  }

  goBack(): void {
    this.router.navigate(['/gen-masters/inventory/product-types/list']);
  }

  // Método para obtener mensajes de validación
  getValidationMessage(fieldName: string): string {
    const control = this.productTypeForm.get(fieldName);
    return this.validationMessagesService.getFieldErrorMessage(control, fieldName) || '';
  }

  // Método para verificar si hubo cambios en el formulario
  private hasFormChanges(): boolean {
    if (!this.originalProductTypeData) return false;
    const formData = this.productTypeForm.value;
    
    return (
      formData.name !== this.originalProductTypeData.name ||
      formData.description !== this.originalProductTypeData.description ||
      formData.sellable !== this.originalProductTypeData.sellable ||
      formData.purchasable !== this.originalProductTypeData.purchasable ||
      formData.inventoryable !== this.originalProductTypeData.inventoryable
    );
  }

  // Método público para verificar si hubo cambios (usado en el template)
  hasChanges(): boolean {
    if (!this.originalProductTypeData) return false;
    return this.hasFormChanges();
  }

  get isSubmitDisabled(): boolean {
    return this.productTypeForm.invalid || !this.hasChanges();
  }
}