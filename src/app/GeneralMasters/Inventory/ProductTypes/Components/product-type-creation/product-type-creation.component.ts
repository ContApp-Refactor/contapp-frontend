import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';

import { ProductTypeService } from '../../Services/product-type.service';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';

@Component({
  selector: 'app-product-type-creation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, // Esencial para formularios reactivos en componentes Standalone
    RouterModule,
    CardModule,
    InputTextModule,
    TextareaModule,
    CheckboxModule,
    ButtonModule,
    ToastModule
  ],
  templateUrl: './product-type-creation.component.html',
})
export class ProductTypeCreationComponent implements OnInit {
  productTypeForm: FormGroup;
  localStorageMethods = new LocalStorageMethods();
  entData: string | null = null;
  formSubmitAttempt = false;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly productTypeService: ProductTypeService,
    private readonly router: Router,
    private readonly messageService: MessageService
  ) {
    this.productTypeForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.maxLength(500)]],
      // Clasificación HU1: vendible/comprable por defecto; inventariable es explícito (habilita kardex)
      sellable: [true],
      purchasable: [true],
      inventoryable: [false]
    });
  }

  ngOnInit(): void {
    this.entData = this.localStorageMethods.getIdEnterprise();
    if (!this.entData) {
      console.error("No se encontró el ID de la empresa. No se pueden cargar los datos del formulario.");
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo identificar la empresa. Vuelva a iniciar sesión.'
      });
    }
  }

  onSubmit(): void {
    this.formSubmitAttempt = true;
    if (this.productTypeForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario incompleto',
        detail: 'Por favor, complete todos los campos requeridos.'
      });
      // Marcar todos los campos como "tocados" para mostrar los errores
      this.productTypeForm.markAllAsTouched();
      return;
    }

    if (!this.entData) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo identificar la empresa. Vuelva a iniciar sesión.'
      });
      return;
    }

    const formData = { ...this.productTypeForm.value };
    formData.enterpriseId = this.entData;

    this.productTypeService.createProductType(formData).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Registro Exitoso',
          detail: 'El tipo de producto ha sido creado exitosamente.',
          life: 3000
        });
        this.router.navigate(['/gen-masters/inventory/product-types/list']);
      },
      error: (error) => {
        const message = error.error?.message || 'Ha ocurrido un error al crear el tipo de producto. Por favor, inténtelo de nuevo.';
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
    });
  }

  goBack(): void {
    this.router.navigate(['/gen-masters/inventory/product-types/list']);
  }

  get isSubmitDisabled(): boolean {
    return this.productTypeForm.invalid;
  }
}