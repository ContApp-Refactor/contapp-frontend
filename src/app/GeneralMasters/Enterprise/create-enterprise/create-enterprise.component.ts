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
import { EnterpriseService, TaxLiability, TaxPayerType, EnterpriseType, DepartmentLookup, CountryLookup } from '../services/enterprise.service';
import { EnterpriseDetails } from '../models/EnterpriseDetails';
import { Enterprise } from '../models/enterprise';
import { EnterpriseList } from '../models/EnterpriseList';
import { SubjectService } from '../../Subjects/services/subjects.service';
import { Subject } from '../../Subjects/models/subjects';

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

  // Catálogos cargados desde el backend
  enterpriseTypes: EnterpriseType[] = [];
  taxLiabilities: TaxLiability[] = [];
  taxPayerTypes: TaxPayerType[] = [];
  countries: CountryLookup[] = [];
  departments: DepartmentLookup[] = [];
  cities: Array<{ id: number; name: string }> = [];

  inventoryMethods = [
    { value: 'PEPS', label: 'PEPS (Primero en Entrar, Primero en Salir)' },
    { value: 'WEIGHTED_AVERAGE', label: 'Promedio Ponderado' },
  ];

  subjectsList: Subject[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private enterpriseService: EnterpriseService,
    private subjectService: SubjectService,
    private messageService: MessageService
  ) {}

  // Inicialización del componente
  ngOnInit(): void {
    this.loadCatalogs();
    this.initForm();
    this.loadSubjects();
  }

  /** Carga todos los catálogos necesarios para los dropdowns */
  loadCatalogs(): void {
    this.enterpriseService.getEnterpriseTypes().subscribe({
      next: (data) => (this.enterpriseTypes = data),
      error: (err) => console.error('Error cargando tipos de empresa:', err),
    });

    this.enterpriseService.getTaxLiabilities().subscribe({
      next: (data) => (this.taxLiabilities = data),
      error: (err) => console.error('Error cargando responsabilidades tributarias:', err),
    });

    this.enterpriseService.getTaxPayerTypes().subscribe({
      next: (data) => (this.taxPayerTypes = data),
      error: (err) => console.error('Error cargando tipos de contribuyente:', err),
    });

    this.enterpriseService.getCountries().subscribe({
      next: (data) => (this.countries = data),
      error: (err) => console.error('Error cargando países:', err),
    });

    this.enterpriseService.getDepartments().subscribe({
      next: (data) => (this.departments = data),
      error: (err) => console.error('Error cargando departamentos:', err),
    });
  }

  /** Maneja cambio de departamento: carga ciudades y limpia la selección actual */
  onDepartmentChange(department: DepartmentLookup | null): void {
    this.cities = [];
    this.enterpriseForm.patchValue({ city: null });
    if (department?.id) {
      this.enterpriseService.getCities(department.id.toString()).subscribe({
        next: (resp) => (this.cities = resp.cities || []),
        error: (err) => console.error('Error cargando ciudades:', err),
      });
    }
  }

  // Inicialización del formulario reactivo
  initForm(): void {
    this.enterpriseForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      enterpriseType: [null, Validators.required],
      taxLiabilities: [[], Validators.required],
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
      subject: [null, Validators.required],
      semester: [null, Validators.required],
      address: ['', [Validators.required, Validators.minLength(10)]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{7,10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      hasBranches: [false],
      inventoryConfigurationType: [null, Validators.required],
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
    if (this.enterpriseForm.valid && this.selectedFile) {
      this.loading = true;
      const f = this.enterpriseForm.value;

      // Transformación para la API
      const enterpriseDetailsApi = {
        name: f.name,
        nit: f.nit,
        dv: f.dv,
        phone: '+57 ' + f.phone,
        branch: f.hasBranches ? 'Comercio al por mayor' : 'Comercio minorista',
        email: f.email,
        logo: 'https://cdn.tusitio.com/logos/' + this.selectedFile.name,
        mainActivity: parseInt(f.mainActivity),
        secondaryActivity: f.secondaryActivity
          ? parseInt(f.secondaryActivity)
          : undefined,
        taxLiabilities: f.taxLiabilities.map((t: any) => t.id || t),
        state: 'ACTIVE',
        taxPayerType: f.taxPayerType.id || f.taxPayerType,
        inventoryConfigurationType: f.inventoryConfigurationType.value || f.inventoryConfigurationType,
        enterpriseType: f.enterpriseType.id || f.enterpriseType,
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
          city: f.city.id || f.city,
          department: f.department.id || f.department,
          country: f.country.id || f.country,
        },
        subjects: f.subject
          ? [
              {
                name: f.subject.name,
                code: f.subject.code,
              },
            ]
          : undefined,
        semester: f.semester,
      };

      console.log('🧾 JSON enviado al backend (enterpriseDetailsApi):');
      console.log(JSON.stringify(enterpriseDetailsApi, null, 2));

      this.enterpriseService.createEnterprise(enterpriseDetailsApi).subscribe({
        next: () => {
          this.loading = false;
          this.router.navigate(['/enterprise/list']);
        },
        error: (err) => {
          console.error('Error al crear empresa:', err);
          this.loading = false;
        },
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Faltan campos por llenar',
      });
    }
  }

  // Navegación de regreso a la lista de empresas
  goBack(): void {
    this.router.navigate(['/enterprise/list']);
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

  /* ==================== CARGAR MATERIAS ==================== */
  loadSubjects(): void {
    this.subjectService.getAllSubjects().subscribe({
      next: (data) => {
        this.subjectsList = data;
      },
      error: (err) => {
        console.error('Error al cargar materias:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las materias desde el servidor.',
        });
      },
    });
  }
}
