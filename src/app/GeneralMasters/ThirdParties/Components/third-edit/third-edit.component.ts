import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';

// Models and Services
import { Third } from '../../models/Third';
import { ePersonType } from '../../models/ePersonType';
import { ThirdService } from '../../Services/third.service';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { ThirdServiceConfigurationService } from '../../Services/third-configuration.service';
import { ThirdType } from '../../models/ThirdType';
import { TypeId } from '../../models/TypeId';
import { eThirdGender } from '../../models/eThirdGender';
import { ThirdFormService } from '../../Services/third-form.service';
import { ThirdValidationService } from '../../Services/third-validation.service';
import { GeographyHelperService } from '../../Services/geography-helper.service';
import { ThirdValidationMessagesService } from '../../Services/third-validation-messages.service';

// Shared Components
import { FormFieldLabelComponent } from '../shared/form-field-label.component';
import { FormPanelComponent } from '../shared/form-panel.component';
import { FormFieldErrorComponent } from '../shared/form-field-error.component';

// External libraries
import Swal from 'sweetalert2';

@Component({
  selector: 'app-third-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    RadioButtonModule,
    ToastModule,
    CardModule,
    DividerModule,
    TooltipModule,
    InputNumberModule,
    SelectModule,
    FormFieldLabelComponent,
    FormPanelComponent,
    FormFieldErrorComponent
  ],
  providers: [DatePipe],
  templateUrl: './third-edit.component.html',
  styleUrl: './third-edit.component.css'
})
export class ThirdEditComponent implements OnInit {

  
  /** Indica si se ha cargado una persona natural */
  PersonaCargadaNatural = false;

  /** Indica si se ha cargado una persona jurídica */
  PersonaCargadaJuridica = false;

  /** Estado guardado del tercero (Activo/Inactivo) */
  EstadoGuardado = '';

  /** Fecha actual del sistema */
  currentDate = new Date();

  /** ID del tercero a editar */
  thirdId: number = 0;

  /** Nombre del país seleccionado */
  CountryName = "";

  /** Nombre de la provincia/departamento seleccionado */
  ProvinceName = "";

  /** Datos del tercero en edición */
  thirdEdit: Third = {} as Third;

  /** Posición actual del mouse */
  mousePosition = { x: 0, y: 0 };

  /** Posición inicial del mouse */
  positionInicial = { x: 0, y: 0 };

  /** Datos iniciales del tercero */
  thirdData: Third = {
    thId: 0,
    entId: '',
    typeId:  {
      entId: "0",
      typeId: "CC",
      typeIdname: "CC",
      status: true,
      classification: "NATURAL_PERSON"
    },
    thirdTypes: [],
    rutPath: undefined,
    personType: ePersonType.natural,
    names: undefined,
    lastNames: undefined,
    socialReason: undefined,
    gender: undefined,
    idNumber: 0,
    verificationNumber: 0,
    state: true,
    photoPath: undefined,
    country: null,
    province: null,
    city: null,
    address: '',
    phoneNumber: '',
    email: ''
  };

  /** Textos de ayuda para los tooltips */
  helpTexts: { [key: string]: string } = {};

  /** Tooltip que está siendo editado */
  editingHelp: string | null = null;

  /** Visibilidad de tooltips */
  helpVisible: { [key: string]: boolean } = {};

  /** Formulario reactivo para edición de terceros */
  createdThirdForm!: FormGroup;

  /** Indica si el formulario ha sido enviado */
  submitted = false;

  /** Indica si el formulario tiene cambios sin guardar */
  hasChanges = false;

  /** Valores iniciales del formulario para comparación */
  private initialFormValue: any = null;

  /** Estados de los botones de tipo de persona */
  button1Checked = false; // Jurídica
  button2Checked = false; // Natural

  /** Lista de tipos de tercero disponibles */
  thirdTypes: ThirdType[] = [];

  /** Lista de tipos de identificación disponibles */
  typeIds: TypeId[] = [];

  /** Lista de tipos de identificación filtrados según el tipo de persona */
  filteredTypeIds: TypeId[] = [];

  /** Término de búsqueda actual para tipos de tercero */
  thirdTypeSearchTerm: string = '';

  /** Término de búsqueda actual para tipos de identificación */
  typeIdSearchTerm: string = '';

  /** Indica si se está cargando los tipos de tercero */
  loadingThirdTypes: boolean = false;

  /** Indica si se está cargando los tipos de identificación */
  loadingTypeIds: boolean = false;

  /** Lista de departamentos */
  departments: any[] = [];

  /** Lista de ciudades */
  cities: any[] = [];

  /** Lista de países */
  countries: any[] = [];

  /** Lista de géneros para dropdown */
  genders = [
    { label: 'Masculino', value: eThirdGender.masculino },
    { label: 'Femenino', value: eThirdGender.femenino },
    { label: 'Otro', value: eThirdGender.Otro }
  ];

  /** Estados para radio buttons */
  states = [
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false }
  ];

  /** Tipos de persona para radio buttons */
  personTypes = [
    { label: 'Jurídica', value: ePersonType.juridica },
    { label: 'Natural', value: ePersonType.natural }
  ];

  /** ID de la empresa */
  entData: string = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly thirdService: ThirdService,
    private readonly thirdConfigurationService: ThirdServiceConfigurationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly datePipe: DatePipe,
    private readonly http: HttpClient,
    private readonly messageService: MessageService,
    private readonly localStorageMethods: LocalStorageMethods,
    private readonly thirdFormService: ThirdFormService,
    private readonly thirdValidationService: ThirdValidationService,
    private readonly geographyHelperService: GeographyHelperService,
    public readonly thirdValidationMessagesService: ThirdValidationMessagesService
  ) {
    this.entData = this.localStorageMethods.getIdEnterprise();
    this.initializeForm();
    this.initializeHelpTexts();
  }

  ngOnInit(): void {
    this.route.params.subscribe(async params => {
      this.thirdId = +params['id'];
      
      if (this.thirdId) {
        await this.loadInitialData();
        this.loadThirdData();
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se proporcionó un ID de tercero válido'
        });
      }
    });
  }

  /**
   * Inicializa el formulario reactivo
   */
  private initializeForm(): void {
    this.createdThirdForm = this.fb.group({
      personType: ['', Validators.required],
      thirdType: [null, Validators.required],
      typeId: ['', Validators.required],
      idNumber: ['', [Validators.required, Validators.min(1)]],
      verificationNumber: [''],
      names: [''],
      lastNames: [''],
      socialReason: [''],
      gender: [''],
      country: [''],
      province: [''],
      city: [{ value: '', disabled: true }], 
      address: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });

    // Configurar validaciones dinámicas
    this.setupDynamicValidations();
    this.setupProvinceChangeHandler();
  }

  /**
   * Configura el manejador de cambios del departamento para habilitar/deshabilitar ciudad
   */
  private setupProvinceChangeHandler(): void {
    this.createdThirdForm.get('province')?.valueChanges.subscribe(value => {
      const cityControl = this.createdThirdForm.get('city');
      if (value) {
        cityControl?.enable();
      } else {
        cityControl?.disable();
        cityControl?.setValue('');
      }
    });
  }

  /**
   * Configura validaciones dinámicas según el tipo de persona
   */
  private setupDynamicValidations(): void {
    this.createdThirdForm.get('personType')?.valueChanges.subscribe(value => {
      const namesControl = this.createdThirdForm.get('names');
      const lastNamesControl = this.createdThirdForm.get('lastNames');
      const socialReasonControl = this.createdThirdForm.get('socialReason');
      const genderControl = this.createdThirdForm.get('gender');

      if (value === ePersonType.natural) {
        // Persona natural: nombres y apellidos requeridos, género opcional
        namesControl?.setValidators([Validators.required]);
        lastNamesControl?.setValidators([Validators.required]);
        socialReasonControl?.clearValidators();
        genderControl?.clearValidators(); // Género ahora opcional

        this.button2Checked = true;
        this.button1Checked = false;
        this.PersonaCargadaNatural = true;
        this.PersonaCargadaJuridica = false;

        // Filtrar tipos de identificación para persona natural
        this.applyPersonTypeFilter();

        // Limpiar DV para persona natural
        this.createdThirdForm.get('verificationNumber')?.setValue(null);

        // Restaurar validaciones básicas del número de identificación
        const idNumberControl = this.createdThirdForm.get('idNumber');
        idNumberControl?.setValidators([Validators.required, Validators.min(1)]);
        idNumberControl?.updateValueAndValidity();
      } else if (value === ePersonType.juridica) {
        // Persona jurídica: razón social requerida
        socialReasonControl?.setValidators([Validators.required]);
        namesControl?.clearValidators();
        lastNamesControl?.clearValidators();
        genderControl?.clearValidators();
        
        this.button1Checked = true;
        this.button2Checked = false;
        this.PersonaCargadaJuridica = true;
        this.PersonaCargadaNatural = false;

        // Filtrar tipos de identificación para persona jurídica
        this.applyPersonTypeFilter();

        // Actualizar validaciones del número de identificación si hay tipo seleccionado
        this.updateIdNumberValidations();

        // Calcular DV si ya hay número de identificación y el tipo es NIT
        const idNumber = this.createdThirdForm.get('idNumber')?.value;
        if (this.shouldCalculateDV() && idNumber) {
          const dv = this.thirdFormService.calculateVerificationDigit(idNumber);
          this.thirdFormService.setVerificationDigit(this.createdThirdForm, dv);
        }
      }

      namesControl?.updateValueAndValidity();
      lastNamesControl?.updateValueAndValidity();
      socialReasonControl?.updateValueAndValidity();
      genderControl?.updateValueAndValidity();
    });

    // Calcular DV automáticamente cuando cambie el número de identificación (solo para persona jurídica con NIT)
    this.createdThirdForm.get('idNumber')?.valueChanges.subscribe(idNumber => {
      if (this.shouldCalculateDV()) {
        if (idNumber && idNumber > 0) {
          const dv = this.thirdFormService.calculateVerificationDigit(idNumber);
          this.thirdFormService.setVerificationDigit(this.createdThirdForm, dv);
        } else {
          // Limpiar DV si no hay número válido
          this.thirdFormService.clearVerificationDigit(this.createdThirdForm);
        }
      }
    });

    // Calcular DV cuando cambie el tipo de identificación y aplicar validaciones
    this.createdThirdForm.get('typeId')?.valueChanges.subscribe(() => {
      this.updateIdNumberValidations();
      
      const idNumber = this.createdThirdForm.get('idNumber')?.value;
      if (this.shouldCalculateDV() && idNumber && idNumber > 0) {
        const dv = this.thirdFormService.calculateVerificationDigit(idNumber);
        this.thirdFormService.setVerificationDigit(this.createdThirdForm, dv);
      } else if (!this.shouldCalculateDV()) {
        // Limpiar DV si cambió a un tipo que no requiere cálculo automático
        this.thirdFormService.clearVerificationDigit(this.createdThirdForm);
      }
    });
  }

  /**
   * Inicializa los textos de ayuda
   */
  private initializeHelpTexts(): void {
    this.helpTexts = {
      'TipoPersona': 'Seleccione si es una persona natural (individual) o jurídica (empresa/organización)',
      'TipoTerceros': 'Seleccione los tipos de tercero que aplican (Cliente, Proveedor, etc.)',
      'TipoIdentificación': 'Seleccione el tipo de documento de identificación',
      'razonSocial': 'Ingrese la razón social para personas jurídicas'
    };
  }

  /**
   * Carga los datos iniciales necesarios
   */
  private async loadInitialData(): Promise<void> {
    try {
      await Promise.all([
        this.loadThirdTypes(),
        this.loadTypeIds(),
        this.loadCountries(),
        this.loadDepartments()
      ]);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error al cargar los datos iniciales'
      });
    }
  }

  /**
   * Carga los datos del tercero a editar
   */
  private loadThirdData(): void {
    this.thirdService.getThirdPartie(this.thirdId, this.entData).subscribe({
      next: (third: Third) => {
        this.thirdEdit = third;
        this.populateForm(third);
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los datos del tercero'
        });
      }
    });
  }

  /**
   * Llena el formulario con los datos del tercero
   */
  private populateForm(third: Third): void {
    // Filtrar tipos de identificación según el tipo de persona
    if (third.personType === ePersonType.natural) {
      this.applyPersonTypeFilter();
    } else if (third.personType === ePersonType.juridica) {
      this.applyPersonTypeFilter();
    }
    
    let selectedTypeId = third.typeId;
    if (third.typeId && this.filteredTypeIds.length > 0) {
      const foundTypeId = this.filteredTypeIds.find(
        t => t.typeId === third.typeId.typeId
      );
      if (foundTypeId) {
        selectedTypeId = foundTypeId;
      }
    }

    let selectedThirdType = null;
    if (third.thirdTypes?.length) {
      const firstType = third.thirdTypes[0];
      selectedThirdType = this.thirdTypes.find(
        t => t.thirdTypeId === firstType.thirdTypeId
      ) ?? firstType;
    }

    this.createdThirdForm.patchValue({
      personType: third.personType,
      thirdType: selectedThirdType,
      typeId: selectedTypeId,
      idNumber: third.idNumber,
      verificationNumber: third.verificationNumber,
      names: third.names,
      lastNames: third.lastNames,
      socialReason: third.socialReason,
      gender: third.gender,
      country: third.country?.countryCode || null,
      province: third.province?.stateCode || null,
      city: third.city?.cityCode || null,
      address: third.address,
      phoneNumber: third.phoneNumber,
      email: third.email
    });

    // Cargar ciudades del departamento seleccionado y habilitar el campo ciudad
    if (third.province) {
      // Habilitar el control de ciudad
      this.createdThirdForm.get('city')?.enable();
      this.loadCities(third.province.stateCode);
    }

    // Guardar valores iniciales para detectar cambios
    setTimeout(() => {
      this.initialFormValue = this.createdThirdForm.value;
      this.setupChangeDetection();
    }, 100);
  }

  /**
   * Configura la detección de cambios en el formulario
   */
  private setupChangeDetection(): void {
    this.createdThirdForm.valueChanges.subscribe(() => {
      this.hasChanges = this.formHasChanges();
    });
  }

  /**
   * Verifica si el formulario tiene cambios respecto a los valores iniciales
   */
  private formHasChanges(): boolean {
    if (!this.initialFormValue) {
      return false;
    }

    const currentValue = this.createdThirdForm.value;
    
    // Comparar cada campo
    return JSON.stringify(this.normalizeFormValue(currentValue)) !== 
           JSON.stringify(this.normalizeFormValue(this.initialFormValue));
  }

  /**
   * Normaliza los valores del formulario para comparación
   */
  private normalizeFormValue(value: any): any {
    const normalized = { ...value };
    
    // Normalizar tipo de tercero (objeto único) comparando por ID
    if (normalized.thirdType && typeof normalized.thirdType === 'object') {
      normalized.thirdType = normalized.thirdType.thirdTypeId;
    }
    
    // Normalizar typeId (comparar solo el ID)
    if (normalized.typeId && typeof normalized.typeId === 'object') {
      normalized.typeId = normalized.typeId.typeId;
    }
    
    return normalized;
  }

  /**
   * Carga los tipos de tercero activos
   */
  private loadThirdTypes(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loadingThirdTypes = true;
      this.thirdConfigurationService.getActiveThirdTypes(this.entData, 0, 50).subscribe({
        next: (response: any) => {
          this.thirdTypes = Array.isArray(response.content) ? response.content : [];
          this.loadingThirdTypes = false;
          resolve();
        },
        error: (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar tipos de tercero'
          });
          this.loadingThirdTypes = false;
          reject(error);
        }
      });
    });
  }

  /**
   * Carga los tipos de identificación activos
   */
  private loadTypeIds(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loadingTypeIds = true;
      this.thirdConfigurationService.getActiveTypeIds(this.entData, 0, 50).subscribe({
        next: (response: any) => {
          this.typeIds = Array.isArray(response.content) ? response.content : [];
          // Aplicar filtro por tipo de persona
          this.applyPersonTypeFilter();
          this.loadingTypeIds = false;
          resolve();
        },
        error: (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar tipos de identificación'
          });
          this.loadingTypeIds = false;
          reject(error);
        }
      });
    });
  }

  /**
   * Aplica el filtro de tipos de identificación según el tipo de persona seleccionado
   */
  private applyPersonTypeFilter(): void {
    const personType = this.thirdFormService.getPersonType(this.createdThirdForm);
    if (personType) {
      this.filteredTypeIds = this.thirdFormService.filterTypeIdsByPersonType(this.typeIds, 
        personType === ePersonType.natural ? 'NATURAL_PERSON' : 'LEGAL_ENTITY');
    } else {
      // Por defecto mostrar tipos para persona natural
      this.filteredTypeIds = this.thirdFormService.filterTypeIdsByPersonType(this.typeIds, 'NATURAL_PERSON');
    }
  }


  /**
   * Carga los países desde el backend
   */
  private loadCountries(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.geographyHelperService.loadCountriesAsOptions().subscribe({
        next: (countries) => {
          this.countries = countries;
          resolve();
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar los países'
          });
          reject(error);
        }
      });
    });
  }

  /**
   * Carga los departamentos desde el backend
   * Por defecto carga los de Colombia (COL)
   */
  private loadDepartments(countryCode: string = 'COL'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.geographyHelperService.loadDepartmentsAsOptions(countryCode).subscribe({
        next: (departments) => {
          this.departments = departments;
          resolve();
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar los departamentos'
          });
          reject(error);
        }
      });
    });
  }

  /**
   * Carga las ciudades de un departamento desde el backend
   * @param stateCode Código del departamento
   * @param countryCode Código del país (por defecto COL)
   */
  private loadCities(stateCode: string, countryCode: string = 'COL'): void {
    this.geographyHelperService.loadCitiesAsOptions(stateCode, countryCode).subscribe({
      next: (cities) => {
        this.cities = cities;
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar las ciudades'
        });
        this.cities = [];
      }
    });
  }

  /**
   * Maneja el cambio de departamento
   * @param stateCode Código del departamento seleccionado
   */
  onDepartmentChange(stateCode: string): void {
    this.createdThirdForm.get('city')?.setValue('');
    this.cities = [];
    if (stateCode) {
      const countryCode = this.createdThirdForm.get('country')?.value || 'COL';
      this.loadCities(stateCode, countryCode);
    }
  }

  /**
   * Maneja el cambio de tipo de persona
   */
  onCheckChange(buttonNumber: number): void {
    if (buttonNumber === 1) {
      this.createdThirdForm.get('personType')?.setValue(ePersonType.juridica);
    } else {
      this.createdThirdForm.get('personType')?.setValue(ePersonType.natural);
    }
  }

  /**
   * Envía el formulario
   */
  OnSubmit(): void {
    this.submitted = true;

    if (this.createdThirdForm.valid) {
      const formData = this.createdThirdForm.getRawValue();
      const { thirdType, ...formFields } = formData;
      
      // Preparar datos para enviar al backend con códigos geográficos
      const updatedThird: any = {
        ...this.thirdEdit,
        ...formFields,
        thirdTypes: thirdType ? [thirdType] : [],
        countryCode: formData.country,
        stateCode: formData.province,
        cityCode: formData.city,
        country: undefined,
        province: undefined,
        city: undefined,
        state: this.thirdEdit.state // Mantener el estado original
      };

      this.thirdService.UpdateThird(updatedThird).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Actualización exitosa',
            detail: 'Tercero actualizado correctamente'
          });
          
          this.router.navigate(['/gen-masters/third-parties/list']);
        },
        error: (error: any) => {
          // Verificar si el error específico de tercero en uso
          const errorCode = error?.error?.code || error?.code || '';
          if (errorCode === 'THIRD_IN_USE') {
            this.messageService.add({
              severity: 'info',
              summary: 'Información',
              detail: error?.error?.message || 'No se puede editar el tercero porque tiene movimientos contables'
            });
            // Redirigir inmediatamente a la lista de terceros
            this.router.navigate(['/gen-masters/third-parties/list']);
            return;
          }

          // Extraer el mensaje de error más específico disponible
          const errorMessage = error.error?.message || error.message || 'Error al actualizar el tercero';

          // Determinar el título según el tipo de error
          let errorTitle = 'Error';
          if (error.status === 409) {
            errorTitle = 'Registro Duplicado';
          } else if (error.status === 400) {
            errorTitle = 'Datos Inválidos';
          } else if (error.status === 404) {
            errorTitle = 'No Encontrado';
          } else if (error.status >= 500) {
            errorTitle = 'Error del Servidor';
          }

          this.messageService.add({
            severity: 'error',
            summary: errorTitle,
            detail: errorMessage
          });
        }
      });
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario inválido',
        detail: 'Por favor complete todos los campos requeridos'
      });
    }
  }

  /**
   * Cancela la edición y regresa a la lista
   */
  onCancel(): void {
    this.router.navigate(['/gen-masters/third-parties/list']);
  }

  // Métodos para manejo de tooltips (conservando funcionalidad original)
  toggleHelp(field: string, event: MouseEvent): void {
    this.mousePosition = { x: event.clientX, y: event.clientY };
    this.helpVisible[field] = !this.helpVisible[field];
  }

  showHelp(field: string): void {
    this.helpVisible[field] = true;
  }

  hideHelp(field: string): void {
    this.helpVisible[field] = false;
  }

  isHelpVisible(field: string): boolean {
    return this.helpVisible[field] || false;
  }

  noisHelpVisible(field: string): boolean {
    return !this.isHelpVisible(field);
  }

  isEditing(field: string): boolean {
    return this.editingHelp === field;
  }

  stopEditing(): void {
    this.editingHelp = null;
  }

  /**
   * Actualiza las validaciones del número de identificación según el tipo seleccionado
   */
  private updateIdNumberValidations(): void {
    this.thirdValidationService.updateIdNumberValidations(
      this.createdThirdForm,
      this.thirdFormService.getTypeId(this.createdThirdForm),
      this.thirdFormService.getPersonType(this.createdThirdForm)
    );
  }

  /**
   * Verifica si se debe calcular el DV automáticamente
   */
  shouldCalculateDV(): boolean {
    return this.thirdFormService.shouldCalculateDV(
      this.thirdFormService.getPersonType(this.createdThirdForm),
      this.thirdFormService.getTypeId(this.createdThirdForm)
    );
  }

  /**
   * Verifica si el campo DV debe estar en solo lectura
   */
  isDVReadonly(): boolean {
    return this.thirdFormService.isDVReadonly(
      this.thirdFormService.getPersonType(this.createdThirdForm),
      this.thirdFormService.getTypeId(this.createdThirdForm)
    );
  }

  /**
   * Permite solo la entrada de números (0-9) en el input de DV
   */
  onlyNumbersInput(event: Event): void {
    this.thirdFormService.onlyNumbersInput(event as KeyboardEvent);
  }
}