import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductType } from '../../../ProductTypes/Models/ProductType';
import { UnitOfMeasure } from '../../../MeasurementUnits/Models/UnitOfMeasure';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { ProductService } from '../../Services/product.service';
import { UnitOfMeasureService } from '../../../MeasurementUnits/Services/unit-of-measure.service';
import { CategoryService } from '../../../Category/Services/category.service';
import { ProductTypeService } from '../../../ProductTypes/Services/product-type.service';
import { ValidationMessagesService } from '../../Services/validation-messages.service';

@Component({
  selector: 'app-product-creation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, // Esencial para formularios reactivos en componentes Standalone
    RouterModule,
    CardModule,
    InputTextModule,
    SelectModule,
    ButtonModule,
    InputNumberModule,
    CalendarModule,
    ToastModule
  ],
  templateUrl: './product-creation.component.html',
  styleUrls: ['./product-creation.component.css'],
})
export class ProductCreationComponent implements OnInit {
  productForm: FormGroup;
  unitOfMeasures: any[] = [];
  categories: any[] = [];
  productTypes: ProductType[] = [];

  localStorageMethods = new LocalStorageMethods();
  entData: string = '';
  formSubmitAttempt = false;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly productService: ProductService,
    private readonly unitOfMeasureService: UnitOfMeasureService,
    private readonly categoryService: CategoryService,
    private readonly productTypeService: ProductTypeService,
    private readonly router: Router,
    private readonly messageService: MessageService,
    private readonly validationMessagesService: ValidationMessagesService
  ) {
    const today = new Date().toISOString().split('T')[0];
    this.productForm = this.formBuilder.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      reference: ['', Validators.required],
      presentation: ['', Validators.required], 
      quantity: [0],
      cost: [0],
      unitOfMeasureId: [null, Validators.required],
      categoryId: [null, Validators.required],
      productTypeId: [null, Validators.required],
      creationDate: [today, Validators.required],
      state: [true],
    });
  }

  ngOnInit(): void {

    this.entData = this.localStorageMethods.getIdEnterprise();
    if (this.entData) {
      this.loadInitialData();
    } else {
      console.error("No se encontró el ID de la empresa. No se pueden cargar los datos del formulario.");
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo identificar la empresa. Vuelva a iniciar sesión.'
      });
    }
  }

  // Método para obtener mensajes de validación
  getValidationMessage(fieldName: string): string {
    const control = this.productForm.get(fieldName);
    return this.validationMessagesService.getFieldErrorMessage(control, fieldName) || '';
  }

  loadInitialData(): void {
    this.getUnitOfMeasures();
    this.getCategories();
    this.loadProductTypes();
  }

  loadProductTypes(): void {
    this.productTypeService.findActivate(this.entData).subscribe({
      next: (data: ProductType[]) => this.productTypes = data,
      error: (err: any) => console.error('Error al cargar tipos de producto activos', err)
    });
  }

  getCategories(): void {
    this.categoryService.findActivate(this.entData).subscribe({
      next: (data) => this.categories = data,
      error: (err) => console.error('Error al obtener las categorías:', err)
    });
  }

  getUnitOfMeasures(): void {
    this.unitOfMeasureService.findActivate(this.entData).subscribe({
      next: (data: UnitOfMeasure[]) => {
        this.unitOfMeasures = data;
      },
      error: (err: any) => {
        console.error('Error al obtener las unidades de medida:', err);
      }
    });
  }

  onSubmit(): void {
    this.formSubmitAttempt = true;
    if (this.productForm.invalid) {
      // Marcar todos los campos como "tocados" para mostrar los errores
      this.productForm.markAllAsTouched();
      return;
    }

    const formData = { ...this.productForm.value };
    
    const productData = {
      name: formData.name,
      description: formData.description,
      reference: formData.reference,
      presentation: formData.presentation,
      quantity: Number(formData.quantity),
      cost: Number(formData.cost),
      unitOfMeasureId: formData.unitOfMeasureId, // Ya es ID gracias a optionValue
      categoryId: formData.categoryId, // Ya es ID gracias a optionValue
      productTypeId: formData.productTypeId, // Ya es ID gracias a optionValue
      creationDate: formData.creationDate,
      state: formData.state,
      enterpriseId: this.entData
    };


    this.productService.createProduct(productData as any).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Registro Exitoso',
          detail: 'El producto ha sido creado exitosamente.',
          life: 3000
        });
        this.router.navigate(['/gen-masters/inventory/products/list'], { queryParamsHandling: 'preserve' }); // Redirigir a la lista
      },
      error: (err) => {
        console.error('Error al crear el producto:', err);
        const message = err.error?.message || 'Ha ocurrido un error al crear el producto. Por favor, inténtelo de nuevo.';
        let summary = 'Error';
        if (message.includes('Ya existe') || message.includes('duplicado') || message.includes('Duplicate')) {
          summary = 'Registro Duplicado';
        }
        this.messageService.add({
          severity: 'error',
          summary: summary,
          detail: message
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/gen-masters/inventory/products/list'], { queryParamsHandling: 'preserve' });
  }
}