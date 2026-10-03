import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { HeaderComponent } from '../../../Core/Components/Header/header.component';
import { EnterpriseService, TaxLiability, TaxPayerType, EnterpriseType, DepartmentLookup, CountryLookup } from '../services/enterprise.service';
import { EnterpriseDetails } from '../models/EnterpriseDetails';
import {
  LocalStorageMethods,
  EntData,
} from '../../../Shared/Methods/local-storage.method';

@Component({
  selector: 'app-edit-enterprise',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    MultiSelectModule,
    CheckboxModule,
    ToastModule,
    HeaderComponent,
  ],
  providers: [MessageService],
  templateUrl: './edit-enterprise.component.html',
  styleUrl: './edit-enterprise.component.css',
})
export class EditEnterpriseComponent implements OnInit {
  enterpriseForm!: FormGroup;
  personType: 'juridica' | 'natural' = 'juridica';
  selectedFile: File | null = null;
  loading: boolean = false;
  enterpriseData: EnterpriseDetails | null = null;
  enterpriseId: string = '';
  entData: EntData | null = null;

  // Catálogos cargados desde el backend
  enterpriseTypes: EnterpriseType[] = [];
  taxLiabilities: TaxLiability[] = [];
  taxPayerTypes: TaxPayerType[] = [];
  countries: CountryLookup[] = [];
  departments: DepartmentLookup[] = [];
  cities: Array<{ id: number; name: string }> = [];

  localStorageMethods: LocalStorageMethods = new LocalStorageMethods();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private enterpriseService: EnterpriseService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    // Los catálogos se cargan ANTES que la empresa: patchLookupValues() busca
    // por id dentro de estos arrays, así que si la respuesta de la empresa
    // llegara primero quedarían vacíos y los dropdowns no se precargarían.
    this.loadCatalogs().subscribe({
      next: () => this.loadEnterpriseData(),
      error: (err) => {
        console.error('Error cargando catálogos:', err);
        this.loadEnterpriseData();
      },
    });
  }

  /** Carga todos los catálogos necesarios para los dropdowns */
  loadCatalogs(): Observable<void> {
    /** Evita que un catálogo caído deje sin opciones a todos los demás */
    const safe = <T>(source: Observable<T>): Observable<T> =>
      source.pipe(
        catchError((err) => {
          console.error('Error cargando catálogos:', err);
          return of([] as T);
        })
      );

    return forkJoin({
      enterpriseTypes: safe(this.enterpriseService.getEnterpriseTypes()),
      taxLiabilities: safe(this.enterpriseService.getTaxLiabilities()),
      taxPayerTypes: safe(this.enterpriseService.getTaxPayerTypes()),
      countries: safe(this.enterpriseService.getCountries()),
      departments: safe(this.enterpriseService.getDepartments()),
    }).pipe(
      map((catalogs) => {
        this.enterpriseTypes = catalogs.enterpriseTypes;
        this.taxLiabilities = catalogs.taxLiabilities;
        this.taxPayerTypes = catalogs.taxPayerTypes;
        this.countries = catalogs.countries;
        this.departments = catalogs.departments;
      })
    );
  }

  /** ====================================
   *  Cargar datos de la empresa
   *  ==================================== */
  loadEnterpriseData(): void {
    this.entData = this.localStorageMethods.loadEnterpriseData();

    if (this.entData?.id) {
      this.enterpriseId = this.entData.id;
      this.loading = true;
      this.enterpriseService.getEnterpriseById(this.enterpriseId).subscribe({
        next: (data: EnterpriseDetails) => {
          this.enterpriseData = data;
          this.personType = data.personType?.type?.toLowerCase() || 'juridica';
          this.initForm();
          this.patchLookupValues();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar datos de la empresa:', error);
          this.loading = false;
        },
      });
    }
  }

  /** Rellena los controles de catálogo con los objetos completos desde las opciones cargadas */
  private patchLookupValues(): void {
    if (!this.enterpriseData) return;

    const form = this.enterpriseForm;

    // enterpriseType
    if (this.enterpriseData.enterpriseType?.id) {
      const match = this.enterpriseTypes.find((et) => et.id === this.enterpriseData!.enterpriseType!.id);
      if (match) form.patchValue({ enterpriseType: match });
    }

    // taxPayerType
    if (this.enterpriseData.taxPayerType?.id) {
      const match = this.taxPayerTypes.find((tpt) => tpt.id === this.enterpriseData!.taxPayerType!.id);
      if (match) form.patchValue({ taxPayerType: match });
    }

    // country
    if (this.enterpriseData.location?.country?.id) {
      const match = this.countries.find((c) => c.id === this.enterpriseData!.location!.country!.id);
      if (match) form.patchValue({ country: match });
    }

    // department
    if (this.enterpriseData.location?.department?.id) {
      const match = this.departments.find((d) => d.id === this.enterpriseData!.location!.department!.id);
      if (match) {
        form.patchValue({ department: match });
        // Si hay ciudad, cargar ciudades de ese departamento
        if (this.enterpriseData.location?.city?.id) {
          this.loadCitiesForDepartment(match.id.toString());
        }
      }
    }

    // taxLiabilities (multiselect - array of objects)
    if (Array.isArray(this.enterpriseData.taxLiabilities) && this.enterpriseData.taxLiabilities.length > 0) {
      const matched = this.enterpriseData.taxLiabilities
        .map((tl: any) => this.taxLiabilities.find((opt) => opt.id === tl.id))
        .filter((opt: any) => opt !== undefined);
      if (matched.length > 0) form.patchValue({ taxLiabilities: matched });
    }
  }

  /** Carga ciudades para un departamento y selecciona la que coincida */
  private loadCitiesForDepartment(departmentId: string): void {
    this.enterpriseService.getCities(departmentId).subscribe({
      next: (resp) => {
        this.cities = resp.cities || [];
        if (this.enterpriseData?.location?.city?.id) {
          const match = this.cities.find((c) => c.id === this.enterpriseData!.location!.city!.id);
          if (match) this.enterpriseForm.patchValue({ city: match });
        }
      },
      error: (err) => console.error('Error cargando ciudades:', err),
    });
  }

  /** ====================================
   *  Inicializar formulario con datos cargados
   *  ==================================== */
  initForm(): void {
    this.enterpriseForm = this.fb.group({
      name: [this.enterpriseData?.name || '', Validators.required],
      enterpriseType: [this.enterpriseData?.enterpriseType || null],
      taxLiabilities: [this.enterpriseData?.taxLiabilities || []],
      legalName: [this.enterpriseData?.personType?.bussinessName || ''],
      ownerName: [this.enterpriseData?.personType?.name || ''],
      lastNames: [this.enterpriseData?.personType?.surname || ''],
      nit: [this.enterpriseData?.nit || '', Validators.required],
      dv: [this.enterpriseData?.dv || this.enterpriseData?.DV || ''],
      taxPayerType: [this.enterpriseData?.taxPayerType || null],
      mainActivity: [this.enterpriseData?.mainActivity || ''],
      secondaryActivity: [this.enterpriseData?.secondaryActivity || ''],
      country: [this.enterpriseData?.location?.country || null],
      department: [this.enterpriseData?.location?.department || null],
      city: [this.enterpriseData?.location?.city || null],
      address: [this.enterpriseData?.location?.address || ''],
      phone: [this.enterpriseData?.phone?.replace(/^\+57 /, '') || ''],
      email: [this.enterpriseData?.email || ''],
      hasBranches: [this.enterpriseData?.branch === 'Sí'],
    });

    this.updateFormValidations();
  }

  updateFormValidations(): void {
    if (this.personType === 'juridica') {
      this.enterpriseForm
        .get('legalName')
        ?.setValidators([Validators.required]);
      this.enterpriseForm.get('ownerName')?.clearValidators();
      this.enterpriseForm.get('lastNames')?.clearValidators();
    } else {
      this.enterpriseForm.get('legalName')?.clearValidators();
      this.enterpriseForm
        .get('ownerName')
        ?.setValidators([Validators.required]);
      this.enterpriseForm
        .get('lastNames')
        ?.setValidators([Validators.required]);
    }

    this.enterpriseForm.get('legalName')?.updateValueAndValidity();
    this.enterpriseForm.get('ownerName')?.updateValueAndValidity();
    this.enterpriseForm.get('lastNames')?.updateValueAndValidity();
  }

  onPersonTypeChange(type: 'juridica' | 'natural'): void {
    this.personType = type;
    this.updateFormValidations();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.selectedFile = file;
    } else {
      this.selectedFile = null;
    }
  }

  /** ====================================
   *  Enviar actualización parcial (PATCH)
   *  ==================================== */
  onSubmit(): void {
    if (this.enterpriseForm.valid) {
      this.loading = true;
      const formData = this.enterpriseForm.value;
      
      const enterpriseData: EnterpriseDetails = {
        id: this.enterpriseId,
        name: formData.name,
        nit: formData.nit,
        phone: formData.phone,
        branch: formData.hasBranches ? 'Sí' : 'No',
        email: formData.email,
        logo: this.selectedFile ? this.selectedFile.name : (this.enterpriseData?.logo || ''),
        taxLiabilities: formData.taxLiabilities,
        taxPayerType: formData.taxPayerType,
        enterpriseType: formData.enterpriseType,
        personType: this.personType,
        location: {
          country: formData.country,
          department: formData.department,
          address: formData.address
        },
        dv: formData.dv,
        mainActivity: parseInt(formData.mainActivity),
        secondaryActivity: formData.secondaryActivity ? parseInt(formData.secondaryActivity) : undefined,
        inventoryConfigurationType: this.enterpriseData?.inventoryConfigurationType || 'WEIGHTED_AVERAGE', // Mantener el valor actual o usar default
        legalName: this.personType === 'juridica' ? formData.legalName : undefined,
        ownerName: this.personType === 'natural' ? formData.ownerName : undefined,
        lastNames: this.personType === 'natural' ? formData.lastNames : undefined
      };
    if (this.enterpriseForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos requeridos',
        detail: 'Por favor complete los campos mínimos necesarios.',
      });
      return;
    }
    // Asegurar prefijo +57 en el número antes de enviar
    const phoneValue = this.enterpriseForm.value.phone.startsWith('+57')
      ? this.enterpriseForm.value.phone
      : `+57 ${this.enterpriseForm.value.phone}`;

    // console.log(this.enterpriseForm.value); // Verifica el contenido del formulario

    // Transformar los datos para que coincidan con el formato esperado por el backend
    const updatedData: any = {
      name: this.enterpriseForm.value.name,
      nit: this.enterpriseForm.value.nit,
      dv: this.enterpriseForm.value.dv,
      phone: phoneValue,
      branch: this.enterpriseForm.value.mainActivity, // Cambia según el campo correcto
      email: this.enterpriseForm.value.email,
      logo: this.selectedFile
        ? this.selectedFile.name
        : this.enterpriseData?.logo,
      mainActivity: this.enterpriseForm.value.mainActivity,
      secondaryActivity: this.enterpriseForm.value.secondaryActivity,
      taxLiabilities: this.enterpriseForm.value.taxLiabilities.map(
        (liability: any) => liability.id
      ), // Solo IDs
      // state: this.enterpriseData?.state || 'ACTIVE', // Si el estado es requerido
      taxPayerType: this.enterpriseForm.value.taxPayerType?.id, // Solo ID
      enterpriseType: this.enterpriseForm.value.enterpriseType?.id, // Solo ID
      personType: {
        type: this.personType.toUpperCase(),
        name: this.enterpriseForm.value.ownerName || null,
        surname: this.enterpriseForm.value.lastNames || null,
        bussinessName: this.enterpriseForm.value.legalName,
      },
      location: {
        address: this.enterpriseForm.value.address,
        city: this.enterpriseForm.value.city?.id, // Solo ID
        department: this.enterpriseForm.value.department?.id, // Solo ID
        country: this.enterpriseForm.value.country?.id, // Solo ID
      },
    };

    console.log('Datos transformados:', updatedData); // Verifica el objeto transformado

    this.enterpriseService
      .updateEnterprise(this.enterpriseId, updatedData)
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Actualización exitosa',
            detail: 'La empresa ha sido actualizada correctamente.',
          });
          this.router.navigate(['/enterprise/list']);
        },
        error: (error) => {
          console.error('Error al actualizar:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar la empresa.',
          });
        },
      });
    }
  }
  goBack(): void {
    this.router.navigate(['/enterprise/list']);
  }

  validateNumberInput(event: KeyboardEvent, maxLength: number): void {
    const input = event.target as HTMLInputElement;
    const key = event.key;

    // Solo permite números del 0 al 9
    const isNumber = /^[0-9]$/.test(key);

    if (!isNumber || input.value.length >= maxLength) {
      event.preventDefault();
    }
  }
}
