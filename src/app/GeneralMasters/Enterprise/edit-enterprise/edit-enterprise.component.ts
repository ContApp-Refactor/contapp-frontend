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
import { SubjectService } from '../../Subjects/services/subjects.service';
import { AddressService } from '../services/addressService';
import { EnterpriseDetails } from '../models/EnterpriseDetails';
import { TaxService } from '../../../GeneralMasters/Taxes/services/tax.service';
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

  // Opciones simuladas (puedes reemplazarlas por endpoints reales)
  enterpriseTypes = [
    { id: 1, name: 'Privada' },
    { id: 2, name: 'Oficial' },
    { id: 3, name: 'Mixta' },
  ];

  states = [
    { id: 'ACTIVE', name: 'Activo' },
    { id: 'INACTIVE', name: 'Inactivo' },
  ];

  inventoryMethodsOptions = [
    { name: 'PEPS / FIFO', value: 'FIFO' },
    { name: 'UEPS / LIFO', value: 'LIFO' },
    { name: 'Costo Promedio Ponderado', value: 'CPP' },
    { name: 'Identificación Específica', value: 'SPECIFIC' },
  ];

  taxLiabilities: any[] = [];

  taxPayerTypes = [
    { id: 1, name: 'Responsable de IVA' },
    { id: 2, name: 'No Responsable de IVA' },
    { id: 3, name: 'Gran contribuyente' },
  ];

  subjects: any[] = [];

  countries: any[] = [];
  departments: any[] = [];
  cities: any[] = [];

  localStorageMethods: LocalStorageMethods = new LocalStorageMethods();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private enterpriseService: EnterpriseService,
    private subjectService: SubjectService,
    private addressService: AddressService,
    private taxService: TaxService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadSubjects();
    this.loadCountries();
    this.loadTaxLiabilities();
    this.loadEnterpriseData();
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
          const countryId = this.getEntityId(
            this.enterpriseData?.location?.country,
          );
          const departmentId = this.getEntityId(
            this.enterpriseData?.location?.department,
          );
          if (this.countries.length && countryId) {
            this.loadDepartmentsByCountry(countryId);
          }
          if (this.departments.length && departmentId) {
            this.loadCitiesByDepartment(departmentId);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar datos de la empresa:', error);
          this.loading = false;
        },
      });
    }
  }

  /** ====================================
   *  Inicializar formulario con datos cargados
   *  ==================================== */
  initForm(): void {
    this.enterpriseForm = this.fb.group({
      name: [this.enterpriseData?.name || '', Validators.required],
      enterpriseType: [this.getEntityId(this.enterpriseData?.enterpriseType) || null],
      state: [this.enterpriseData?.state || 'ACTIVE'],
      taxLiabilities: [
        this.mapTaxLiabilitiesToIds(this.enterpriseData?.taxLiabilities || []),
      ],
      legalName: [this.enterpriseData?.personType?.bussinessName || ''],
      ownerName: [this.enterpriseData?.personType?.name || ''],
      lastNames: [this.enterpriseData?.personType?.surname || ''],
      nit: [this.enterpriseData?.nit || '', Validators.required],
      dv: [this.enterpriseData?.dv || ''],
      taxPayerType: [this.getEntityId(this.enterpriseData?.taxPayerType) || null],
      mainActivity: [this.enterpriseData?.mainActivity || ''],
      secondaryActivity: [this.enterpriseData?.secondaryActivity || ''],
      inventoryMethods: [this.enterpriseData?.inventoryMethods || null],
      branch: [this.enterpriseData?.branch || ''],
      country: [this.getEntityId(this.enterpriseData?.location?.country) || null],
      department: [this.getEntityId(this.enterpriseData?.location?.department) || null],
      city: [this.getEntityId(this.enterpriseData?.location?.city) || null],
      address: [this.enterpriseData?.location?.address || ''],
      phone: [this.enterpriseData?.phone?.replace(/^\+57 /, '') || ''],
      email: [this.enterpriseData?.email || ''],
      subjects: [
        this.enterpriseData?.subjects?.map((subject) => this.getEntityId(subject.id)) || [],
      ],
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
    if (this.enterpriseForm.get('name')?.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campo requerido',
        detail: 'El nombre de la empresa es requerido.',
      });
      return;
    }

    this.loading = true;

    if (this.selectedFile) {
      this.enterpriseService.uploadLogo(this.selectedFile).subscribe({
        next: (res) => this.doUpdate(res.url),
        error: () => {
          this.loading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo subir el logo.',
          });
        },
      });
    } else {
      const existing = this.enterpriseData?.logo ?? null;
      this.doUpdate(existing?.startsWith('http') ? existing : null);
    }
  }

  private doUpdate(logoUrl: string | null): void {
    const f = this.enterpriseForm.value;
    const phoneValue = f.phone
      ? f.phone.startsWith('+57')
        ? f.phone
        : `+57 ${f.phone}`
      : this.enterpriseData?.phone || '';

    const subjectsIds =
      f.subjects?.length > 0
        ? f.subjects
        : this.enterpriseData?.subjects?.map((subject) => this.getEntityId(subject.id)) || [];

    const updatedData: any = {
      name: f.name || this.enterpriseData?.name || '',
      nit: f.nit || this.enterpriseData?.nit || '',
      dv: f.dv || this.enterpriseData?.dv || '',
      phone: phoneValue,
      branch: this.enterpriseData?.branch || '',
      email: f.email || this.enterpriseData?.email || '',
      logo: logoUrl,
      state: f.state || this.enterpriseData?.state || 'ACTIVE',
      mainActivity:
        f.mainActivity || this.enterpriseData?.mainActivity || undefined,
      secondaryActivity:
        f.secondaryActivity || this.enterpriseData?.secondaryActivity || undefined,
      inventoryMethods:
        f.inventoryMethods || this.enterpriseData?.inventoryMethods || undefined,
      taxLiabilities:
        f.taxLiabilities?.length > 0
          ? f.taxLiabilities.map((id: any) => Number(id))
          : this.mapTaxLiabilitiesToIds(this.enterpriseData?.taxLiabilities || []),
      taxPayerType:
        f.taxPayerType?.id ?? f.taxPayerType ??
        this.getEntityId(this.enterpriseData?.taxPayerType),
      enterpriseType:
        f.enterpriseType?.id ?? f.enterpriseType ??
        this.getEntityId(this.enterpriseData?.enterpriseType),
      personType: {
        type: this.personType.toUpperCase(),
        name: f.ownerName || this.enterpriseData?.personType?.name || null,
        surname: f.lastNames || this.enterpriseData?.personType?.surname || null,
        bussinessName:
          f.legalName || this.enterpriseData?.personType?.bussinessName || null,
      },
      location: {
        address: f.address || this.enterpriseData?.location?.address || '',
        city:
          this.getEntityId(f.city ?? this.enterpriseData?.location?.city) || null,
        department:
          this.getEntityId(
            f.department ?? this.enterpriseData?.location?.department,
          ) || null,
        country:
          this.getEntityId(f.country ?? this.enterpriseData?.location?.country) || null,
      },
      subjects: subjectsIds,
    };

    this.enterpriseService
      .updateEnterprise(this.enterpriseId, updatedData)
      .subscribe({
        next: () => {
          this.loading = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Actualización exitosa',
            detail: 'La empresa ha sido actualizada correctamente.',
          });
          this.router.navigate(['/enterprise/list']);
        },
        error: (error) => {
          console.error('Error al actualizar:', error);
          this.loading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar la empresa.',
          });
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/home']);
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

  private loadSubjects(): void {
    this.subjectService.getAllSubjects().subscribe({
      next: (data) => {
        this.subjects = data;
      },
      error: (err) => {
        console.error('Error al cargar materias:', err);
      },
    });
  }

  private loadCountries(): void {
    this.addressService.getCountries().subscribe({
      next: (data) => {
        this.countries = data;
        const countryId = this.getEntityId(
          this.enterpriseData?.location?.country,
        );
        if (countryId) {
          this.loadDepartmentsByCountry(countryId);
        }
      },
      error: (err) => {
        console.error('Error al cargar países:', err);
      },
    });
  }

  private loadDepartmentsByCountry(countryId: number | string): void {
    this.addressService.getDepartmentsByCountry(countryId).subscribe({
      next: (data) => {
        this.departments = data;
        const departmentId = this.getEntityId(
          this.enterpriseData?.location?.department,
        );
        if (departmentId) {
          this.loadCitiesByDepartment(departmentId);
        }
      },
      error: (err) => {
        console.error('Error al cargar departamentos:', err);
      },
    });
  }

  private loadCitiesByDepartment(departmentId: number | string): void {
    this.addressService.getCitiesByDepartment(departmentId).subscribe({
      next: (data: any) => {
        const raw: any[] = Array.isArray(data)
          ? data
          : data?.cities || data?.content || [];

        this.cities = raw.map((c: any) => ({
          id: Number(c.cityCode ?? c.id ?? c.code),
          name: c.cityName ?? c.name,
          ...c,
        }));

        const cityValue = this.enterpriseData?.location?.city;
        const cityId = cityValue != null
          ? typeof cityValue === 'object'
            ? Number((cityValue as any).cityCode ?? (cityValue as any).id)
            : Number(cityValue)
          : null;

        if (cityId != null && !isNaN(cityId)) {
          setTimeout(() => {
            this.enterpriseForm?.get('city')?.setValue(cityId);
          });
        }
      },
      error: (err) => {
        console.error('Error al cargar ciudades:', err);
      },
    });
  }

  onCountryChange(event: any): void {
    const countryId = event.value;
    this.enterpriseForm.patchValue({ department: null, city: null });
    this.departments = [];
    this.cities = [];
    if (countryId) {
      this.loadDepartmentsByCountry(countryId);
    }
  }

  onDepartmentChange(event: any): void {
    const departmentId = event.value;
    this.enterpriseForm.patchValue({ city: null });
    this.cities = [];
    if (departmentId) {
      this.loadCitiesByDepartment(departmentId);
    }
  }

  private getEntityId(value: any): any {
    if (value == null) {
      return null;
    }
    return typeof value === 'object' ? value.id : value;
  }




    private getEnterpriseId(): string {
    const entData = this.localStorageMethods.loadEnterpriseData();
    return entData?.id || '';
  }

  private loadTaxLiabilities(): void {
    const enterpriseId = this.getEnterpriseId();

    if (!enterpriseId) {
      this.taxLiabilities = [];
      return;
    }

    this.taxService
      .findAll(enterpriseId, 0, 1000, 'description', 'asc', '')
      .subscribe({
        next: (response: any) => {
          const content: any[] = Array.isArray(response)
            ? response
            : Array.isArray(response?.content)
              ? response.content
              : [];

          this.taxLiabilities = content.map((tax: any) => ({
            id: Number(tax.id),
            name: `${tax.code} - ${tax.description}`,
            code: tax.code,
            description: tax.description,
            interest: tax.interest,
            status: typeof tax.status === 'boolean' ? tax.status : false,
          }));

          // Re-apply selection in case the form was initialized before options arrived
          if (this.enterpriseForm && this.enterpriseData?.taxLiabilities?.length) {
            this.enterpriseForm.get('taxLiabilities')?.setValue(
              this.mapTaxLiabilitiesToIds(this.enterpriseData.taxLiabilities)
            );
          }
        },
        error: (err) => {
          console.error('Error al cargar impuestos:', err);
          this.taxLiabilities = [];
        },
      });
  }

  private mapTaxLiabilitiesToIds(taxLiabilities: any[] = []): number[] {
    return taxLiabilities
      .map((tax: any) => Number(tax?.id ?? tax))
      .filter((id: number) => !Number.isNaN(id));
  }
}
