import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { HeaderComponent } from '../../../Core/Components/Header/header.component';
import { EnterpriseService } from '../services/enterprise.service';
import { EnterpriseDetails } from '../models/EnterpriseDetails';
import { Enterprise } from '../models/enterprise';
import { EnterpriseList } from '../models/EnterpriseList';
import { SubjectService } from '../../Subjects/services/subjects.service';
import { Subject } from '../../Subjects/models/subjects';
import { AddressService } from '../services/addressService';
import { Country } from '../../ThirdParties/models/Country';
import { Department } from '../../ThirdParties/models/Department';
import { City } from '../../ThirdParties/models/City';

@Component({
  selector: 'app-create-enterprise',
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
  templateUrl: './create-enterprise.component.html',
  styleUrls: ['./create-enterprise.component.css'],
})
export class CreateEnterpriseComponent implements OnInit {
  enterpriseForm!: FormGroup;
  personType: 'juridica' | 'natural' = 'juridica';
  selectedFile: File | null = null;
  loading: boolean = false;
  activeIndex: number = 0;
  showSuccessModal: boolean = false;
  showExportLoadingModal: boolean = false;
  exportProgress: number = 0;
  private exportInterval: any;

  // Opciones para los dropdowns
  enterpriseTypes = [
    { id: 1, name: 'Privada' },
    { id: 2, name: 'Oficial' },
    { id: 3, name: 'Mixta' },
  ];

  taxLiabilities = [
    { id: 1, name: 'IVA' },
    { id: 2, name: 'ICA' },
    { id: 3, name: 'Retención en la fuente' },
    { id: 4, name: 'Retención de IVA' },
  ];

  taxPayerTypes = [
    { id: 1, name: 'Responsable de IVA' },
    { id: 2, name: 'No responsable de IVA' },
    { id: 3, name: 'Gran contribuyente' },
  ];

  inventoryMethods = [
    { name: 'PEPS / FIFO', value: 'FIFO' },
    { name: 'UEPS / LIFO', value: 'LIFO' },
    { name: 'Costo Promedio Ponderado', value: 'CPP' },
    { name: 'Identificación Específica', value: 'SPECIFIC' },
  ];

  subjects: any[] = [];
  loadedSubjects: Subject[] = [];
  previousSubjectId: number | string | null = null;

  filteredDepartments: any[] = [];
  filteredCities: any[] = [];

  countries: any[] = [];
  departments: any[] = [];
  cities: any[] = [];

  loadedCountries: Country[] = [];
  loadedDepartments: Department[] = [];
  loadedCities: City[] = [];

  previousCountryId: number | string | null = null;
  previousDepartmentId: number | string | null = null;

  private pendingRutCountryName = '';
  private pendingRutDeptName = '';
  private pendingRutCityName = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private enterpriseService: EnterpriseService,
    private subjectService: SubjectService,
    private addressService: AddressService,
    private messageService: MessageService,
  ) {}

  // Inicialización del componente
  ngOnInit(): void {
    this.initForm();
    this.checkForRUTData();
    this.loadCountries();
    this.loadSubjects();
  }
  // Inicialización del formulario reactivo
  initForm(): void {
    this.enterpriseForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      enterpriseType: [null, Validators.required],
      taxLiabilities: [[]],
      legalName: ['', [Validators.required, Validators.minLength(5)]],
      ownerName: ['', [Validators.minLength(2)]],
      lastNames: ['', [Validators.minLength(2)]],
      nit: ['', [Validators.required, Validators.pattern(/^\d{9,10}$/)]],
      dv: ['', [Validators.required, Validators.pattern(/^\d{1}$/)]],
      taxPayerType: [null, Validators.required],
      mainActivity: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      secondaryActivity: ['', [Validators.pattern(/^\d{6}$/)]],
      country: [null],
      department: [null, Validators.required],
      city: [null, Validators.required],
      subject: [null as number | null],
      inventoryMethod: [null, Validators.required],
      address: ['', [Validators.required, Validators.minLength(10)]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{7,10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      hasBranches: [false],
    });

    this.updateFormValidations();
  }

  // Actualiza las validaciones del formulario según el tipo de persona
  updateFormValidations(): void {
    if (this.personType === 'juridica') {
      this.enterpriseForm
        .get('legalName')
        ?.setValidators([Validators.required, Validators.minLength(5)]);
      this.enterpriseForm.get('ownerName')?.clearValidators();
      this.enterpriseForm.get('lastNames')?.clearValidators();
    } else {
      this.enterpriseForm.get('legalName')?.clearValidators();
      this.enterpriseForm
        .get('ownerName')
        ?.setValidators([Validators.required, Validators.minLength(2)]);
      this.enterpriseForm
        .get('lastNames')
        ?.setValidators([Validators.required, Validators.minLength(2)]);
    }

    this.enterpriseForm.get('legalName')?.updateValueAndValidity();
    this.enterpriseForm.get('ownerName')?.updateValueAndValidity();
    this.enterpriseForm.get('lastNames')?.updateValueAndValidity();
  }

  private checkForRUTData(): void {
    const raw = this.enterpriseService.getRutData();
    if (!raw) return;
    this.enterpriseService.clearRutData();

    const fields = raw.split(';');
    if (fields.length < 12) return;

    const typePerson = fields[0]?.toLowerCase() || '';
    const isNatural = typePerson.includes('natural');

    this.personType = isNatural ? 'natural' : 'juridica';
    this.updateFormValidations();

    const nitRaw = fields[2]?.replace(/[^0-9]/g, '') || '';
    const patches: any = {
      nit: nitRaw,
      email: fields[10]?.trim() || '',
      phone: fields[11]?.replace(/[^0-9]/g, '') || '',
      address: fields[9]?.trim() || '',
    };

    if (isNatural) {
      patches.ownerName = fields[5]?.trim() || '';
      patches.lastNames = fields[4]?.trim() || '';
      patches.name = `${fields[5]?.trim() || ''} ${fields[4]?.trim() || ''}`.trim();
    } else {
      patches.legalName = fields[3]?.trim() || '';
      patches.name = fields[3]?.trim() || '';
    }

    this.enterpriseForm.patchValue(patches);

    this.pendingRutCountryName = fields[6]?.trim() || '';
    this.pendingRutDeptName = fields[7]?.trim() || '';
    this.pendingRutCityName = fields[8]?.trim() || '';

    this.messageService.add({
      severity: 'success',
      summary: 'PDF procesado',
      detail: 'Los datos del RUT han sido cargados en el formulario.',
    });
  }

  private applyPendingRutCountry(): void {
    if (!this.pendingRutCountryName || !this.countries.length) return;
    const name = this.pendingRutCountryName.toLowerCase();
    const match = this.countries.find((c: any) =>
      (c.name ?? '').toLowerCase().includes(name) || name.includes((c.name ?? '').toLowerCase()),
    );
    if (match) {
      this.pendingRutCountryName = '';
      this.enterpriseForm.get('country')?.setValue(match.id);
    }
  }

  private applyPendingRutDept(): void {
    if (!this.pendingRutDeptName || !this.filteredDepartments.length) return;
    const name = this.pendingRutDeptName.toLowerCase();
    const match = this.filteredDepartments.find((d: any) =>
      (d.name ?? '').toLowerCase().includes(name) || name.includes((d.name ?? '').toLowerCase()),
    );
    if (match) {
      this.pendingRutDeptName = '';
      setTimeout(() => { this.enterpriseForm.get('department')?.setValue(match.id); });
    }
  }

  private applyPendingRutCity(): void {
    if (!this.pendingRutCityName || !this.filteredCities.length) return;
    const name = this.pendingRutCityName.toLowerCase();
    const match = this.filteredCities.find((c: any) =>
      (c.name ?? '').toLowerCase().includes(name) || name.includes((c.name ?? '').toLowerCase()),
    );
    if (match) {
      this.pendingRutCityName = '';
      setTimeout(() => { this.enterpriseForm.get('city')?.setValue(match.id); });
    }
  }

  // Manejo del cambio de tipo de persona
  onPersonTypeChange(type: 'juridica' | 'natural'): void {
    this.personType = type;
    this.updateFormValidations();
    if (type === 'juridica') {
      this.enterpriseForm.get('ownerName')?.setValue('');
      this.enterpriseForm.get('lastNames')?.setValue('');
    } else {
      this.enterpriseForm.get('legalName')?.setValue('');
    }
  }

  // Manejo de la selección de archivo
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.selectedFile = file;
    } else {
      this.selectedFile = null;
    }
  }

  // Envío del formulario
  onSubmit(): void {
    if (!this.enterpriseForm.valid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Faltan campos por llenar',
      });
      return;
    }

    this.loading = true;
    const f = this.enterpriseForm.value;

    // Si hay logo, subir primero; si no, enviar directamente
    if (this.selectedFile) {
      this.enterpriseService.uploadLogo(this.selectedFile).subscribe({
        next: (res) => {
          this.createEnterpriseWithLogo(f, res.url);
        },
        error: (err) => {
          console.error('Error al subir logo:', err);
          this.loading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo subir el logo.',
          });
        },
      });
    } else {
      this.createEnterpriseWithLogo(f, null);
    }
  }

  private createEnterpriseWithLogo(f: any, logoUrl: string | null): void {
    const enterpriseDetailsApi = {
      name: f.name,
      nit: f.nit,
      dv: f.dv,
      phone: '+57 ' + f.phone,
      branch: f.hasBranches ? 'Comercio al por mayor' : 'Comercio minorista',
      email: f.email,

      logo: logoUrl || null,

      mainActivity: parseInt(f.mainActivity, 10),
      secondaryActivity: f.secondaryActivity
        ? parseInt(f.secondaryActivity, 10)
        : undefined,

      taxLiabilities: f.taxLiabilities.map((t: any) => t.id ?? t),
      state: 'ACTIVE',
      taxPayerType: f.taxPayerType.id ?? f.taxPayerType,
      inventoryMethods: f.inventoryMethod,
      enterpriseType: f.enterpriseType.id ?? f.enterpriseType,

      personType:
        this.personType === 'juridica'
          ? {
              type: 'JURIDICA',
              name: null,
              surname: null,
              bussinessName: f.legalName,
            }
          : {
              type: 'NATURAL',
              name: f.ownerName,
              surname: f.lastNames,
              bussinessName: null,
            },

      location: {
        address: f.address,
        city: f.city,
        department: f.department,
        country: f.country,
      },

      subjects: f.subject ? [f.subject] : [],
    };

    this.enterpriseService.createEnterprise(enterpriseDetailsApi).subscribe({
      next: () => {
        const MIN_TIME = 2000; // 2 segundos
        const startTime = Date.now();

        const finish = () => {
          this.loading = false;
          this.showSuccessModal = true;
        };

        const elapsed = Date.now() - startTime;

        if (elapsed < MIN_TIME) {
          setTimeout(finish, MIN_TIME - elapsed);
        } else {
          finish();
        }
      },
      error: (err) => {
        console.error('Error al crear empresa:', err);
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo crear la empresa.',
        });
      },
    });
  }

  // Navegación de regreso a la lista de empresas
  goBack(): void {
    this.router.navigate(['/enterprise/list']);
  }

  // Permite avanzar al siguiente paso del formulario
  nextStep(): void {
    let fieldsToValidate: string[] = [];

    if (this.activeIndex === 0) {
      fieldsToValidate = [
        'name',
        'nit',
        'dv',
        'enterpriseType',
        'taxPayerType',
      ];

      if (this.personType === 'juridica') {
        fieldsToValidate.push('legalName');
      }

      if (this.personType === 'natural') {
        fieldsToValidate.push('ownerName', 'lastNames');
      }
    }

    if (this.activeIndex === 1) {
      fieldsToValidate = [
        'country',
        // 'department',
        // 'city',
        'address',
        'email',
        'phone',
      ];
    }

    if (this.activeIndex === 2) {
      fieldsToValidate = ['mainActivity'];
    }

    let isStepValid = true;

    fieldsToValidate.forEach((fieldName) => {
      const control = this.enterpriseForm.get(fieldName);
      if (control) {
        control.markAsTouched();
        control.markAsDirty();
        control.updateValueAndValidity();

        const value = control.value;
        const isEmpty =
          value === null ||
          value === undefined ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);

        if (control.invalid || isEmpty) {
          isStepValid = false;
        }
      }
    });

    if (!isStepValid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Campos incompletos',
        detail: 'Complete los campos requeridos antes de continuar.',
      });
      return;
    }

    if (this.activeIndex < 2) {
      if (this.activeIndex === 0) {
        // Saliendo de paso 0, ir a paso 1
        this.activeIndex++;
      } else if (this.activeIndex === 1) {
        // Saliendo de paso 1, ir a paso 2
        this.activeIndex++;
      }
    }
  }

  // Permite regresar al paso anterior
  prevStep(): void {
    if (this.activeIndex > 0) {
      this.activeIndex--;
      if (this.activeIndex === 1) {
        // Regresando a paso 1, refrescar opciones
        this.refreshLocationOptions();
      }
    }
  }

  // validateNumberInput(event: KeyboardEvent): void {
  //   const input = event.target as HTMLInputElement;
  //   const key = event.key;

  //   // Solo permite números y evita más de 10 dígitos
  //   if (!/^[0-9]$/.test(key) || input.value.length >= 10) {
  //     event.preventDefault();
  //   }
  // }

  validateNumberInput(event: KeyboardEvent, maxLength: number): void {
    const input = event.target as HTMLInputElement;
    const key = event.key;

    // Solo permite números del 0 al 9
    const isNumber = /^[0-9]$/.test(key);

    if (!isNumber || input.value.length >= maxLength) {
      event.preventDefault();
    }
  }

  /* ==================== CIUDADES ==================== */
  // filterCities(departmentId: number): void {
  //   this.filteredCities = this.city.filter(
  //     (c) => c.departmentId === departmentId,
  //   );
  // }

  private loadCountries(): void {
    this.addressService.getCountries().subscribe({
      next: (data: Country[]) => {
        this.loadedCountries = data;
        this.countries = data.map((c) => ({
          id: Number(c.countryCode ?? (c as any).id ?? (c as any).code),
          name: c.countryName ?? (c as any).name,
          ...c,
        }));
        this.previousCountryId = null;
        this.previousDepartmentId = null;
        this.initLocationFilters();
        this.applyPendingRutCountry();
      },
      error: (err) => {
        console.error('Error loading countries:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los países.',
        });
      },
    });
  }

  private initLocationFilters(): void {
    // Country → Departments
    this.enterpriseForm.get('country')?.valueChanges.subscribe((countryId) => {
      if (countryId !== null && countryId !== undefined && countryId !== '') {
        // Si es la primera selección o el país cambió
        if (
          this.previousCountryId === null ||
          this.previousCountryId !== countryId
        ) {
          this.loadDepartments(Number(countryId), true);
        } else {
          // El país es el mismo, solo recargar opciones sin resetear
          this.loadDepartments(Number(countryId), false);
        }
      } else {
        this.filteredDepartments = [];
        this.enterpriseForm
          .get('department')
          ?.setValue(null, { emitEvent: false });
        this.filteredCities = [];
        this.previousCountryId = null;
        this.previousDepartmentId = null;
      }
    });

    // Department → Cities
    this.enterpriseForm
      .get('department')
      ?.valueChanges.subscribe((departmentId) => {
        if (
          departmentId !== null &&
          departmentId !== undefined &&
          departmentId !== ''
        ) {
          // Si es la primera selección o el departamento cambió
          if (
            this.previousDepartmentId === null ||
            this.previousDepartmentId !== departmentId
          ) {
            this.loadCities(Number(departmentId), true);
          } else {
            // El departamento es el mismo, solo recargar opciones sin resetear
            this.loadCities(Number(departmentId), false);
          }
        } else {
          this.filteredCities = [];
          this.enterpriseForm.get('city')?.setValue(null, { emitEvent: false });
          this.previousDepartmentId = null;
        }
      });
  }

  private refreshLocationOptions(): void {
    const countryId = this.enterpriseForm.get('country')?.value;
    const departmentId = this.enterpriseForm.get('department')?.value;

    if (countryId !== null && countryId !== undefined && countryId !== '') {
      this.loadDepartments(Number(countryId), false);
    }

    if (
      departmentId !== null &&
      departmentId !== undefined &&
      departmentId !== ''
    ) {
      this.loadCities(Number(departmentId), false);
    }
  }

  private loadDepartments(
    countryCode: number | string,
    resetDepartment = true,
  ): void {
    this.addressService.getDepartmentsByCountry(countryCode).subscribe({
      next: (data: Department[]) => {
        this.loadedDepartments = data;
        this.filteredDepartments = data.map((d) => ({
          id: Number(d.stateCode ?? (d as any).id ?? (d as any).code),
          name: d.stateName ?? (d as any).name,
          ...d,
        }));

        // Solo resetear si el país cambió realmente
        if (resetDepartment && this.previousCountryId !== countryCode) {
          this.previousCountryId = countryCode;
          this.enterpriseForm
            .get('department')
            ?.setValue(null, { emitEvent: false });
          this.previousDepartmentId = null;
          this.filteredCities = [];
        } else if (this.previousCountryId === null) {
          this.previousCountryId = countryCode;
        }
        this.applyPendingRutDept();
      },
      error: (err) => {
        console.error('Error loading departments:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los departamentos.',
        });
      },
    });
  }

  private loadCities(departmentCode: number | string, resetCity = true): void {
    this.addressService.getCitiesByDepartment(departmentCode).subscribe({
      next: (data: any) => {
        const citiesArray: City[] = Array.isArray(data)
          ? data
          : data?.cities || data?.content || [];

        this.loadedCities = citiesArray;
        this.filteredCities = this.loadedCities.map((c) => ({
          id: Number(c.cityCode ?? (c as any).id ?? (c as any).code),
          name: c.cityName ?? (c as any).name,
          ...c,
        }));

        // Solo resetear si el departamento cambió realmente
        if (resetCity && this.previousDepartmentId !== departmentCode) {
          this.previousDepartmentId = departmentCode;
          this.enterpriseForm.get('city')?.setValue(null, { emitEvent: false });
        } else if (this.previousDepartmentId === null) {
          this.previousDepartmentId = departmentCode;
        }
        this.applyPendingRutCity();
      },
      error: (err) => {
        console.error('Error loading cities:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las ciudades.',
        });
      },
    });
  }

  /* ==================== CARGAR MATERIAS ==================== */
  private loadSubjects(): void {
    this.subjectService.getAllSubjects().subscribe({
      next: (data: Subject[]) => {
        this.subjects = data;
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las materias.',
        });
      },
    });
  }

  /* ==================== MODAL DE ÉXITO ==================== */

  closeSuccessModal(): void {
    this.showSuccessModal = false;
  }

  onConfigureSubjects(): void {
    this.showSuccessModal = false;
    this.router.navigate(['/gen-masters/subjects/list']);
  }

  onConfigureTaxes(): void {
    this.showSuccessModal = false;
    this.router.navigate(['/gen-masters/taxes/create']);
  }

  onDoItLater(): void {
    this.showSuccessModal = false;
    this.router.navigate(['/enterprise/list']); // ← ESTE ES EL PROBLEMA
    // Si luego quieres, aquí puedes redirigir al listado:
    // this.router.navigate(['/enterprise/list']);
  }

  /* ====================  MODAL DE EXPORTACIÓN ==================== */
  onExport(): void {
    this.showExportLoadingModal = true;
    this.exportProgress = 0;

    const totalDuration = 4000; // 4 segundos
    const intervalTime = 100; // actualiza cada 100 ms
    const increment = 100 / (totalDuration / intervalTime);

    this.exportInterval = setInterval(() => {
      this.exportProgress += increment;

      if (this.exportProgress >= 100) {
        this.exportProgress = 100;
        clearInterval(this.exportInterval);

        setTimeout(() => {
          this.showExportLoadingModal = false;
        }, 150);
      }
    }, intervalTime);
  }
}
