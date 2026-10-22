import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';

// Models and Services
import { Third } from '../../models/Third';
import { ThirdService } from '../../Services/third.service';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { ThirdServiceConfigurationService } from '../../Services/third-configuration.service';
import { ThirdType } from '../../models/ThirdType';
import { TypeId } from '../../models/TypeId';
import { eThirdGender } from '../../models/eThirdGender';
import { ePersonType } from '../../models/ePersonType';

// Shared Services
import { ThirdFormService } from '../../Services/third-form.service';
import { ThirdValidationService } from '../../Services/third-validation.service';
import { GeographyHelperService } from '../../Services/geography-helper.service';
import { ThirdValidationMessagesService } from '../../Services/third-validation-messages.service';

// Shared Components
import { FormFieldLabelComponent } from '../shared/form-field-label.component';
import { FormPanelComponent } from '../shared/form-panel.component';
import { FormFieldErrorComponent } from '../shared/form-field-error.component';

@Component({
  selector: 'app-third-creation',
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
    CheckboxModule,
    SelectModule,
    FormFieldLabelComponent,
    FormPanelComponent,
    FormFieldErrorComponent
  ],
  providers: [DatePipe, LocalStorageMethods],
  templateUrl: './third-creation.component.html',
  styleUrl: './third-creation.component.css'
})
export class ThirdCreationComponent implements OnInit {

  createdThirdForm!: FormGroup;

  contendPDFRUT: string | null = null;

  infoThird: string[] | null = null;

  submitted = false;

  button1Checked = false;

  button2Checked = false;

  showAdditionalDiv = false;

  countries: any[] = [];

  states: any[] = [];

  thirdTypes: ThirdType[] = [];

  thirdTypeSearchTerm: string = '';
  loadingThirdTypes: boolean = false;

  typeIds: TypeId[] = [];

  filteredTypeIds: TypeId[] = [];

  typeIdSearchTerm: string = '';

  loadingTypeIds: boolean = false;

  cities: any[] = [];

  selectedCountryCode: string = 'COL';

  selectedStateCode: string = '';

  currentDate = new Date();

  entData: string = '';

  /** Datos del tercero por defecto */
  thirdData: Third = {
    thId: 0,
    entId: '',
    typeId: { entId: "0", typeId: "CC", typeIdname: "CC", status: true, classification: "NATURAL_PERSON" },
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

  /** Lista de géneros para dropdown */
  genders = [
    { label: 'Masculino', value: eThirdGender.masculino },
    { label: 'Femenino', value: eThirdGender.femenino },
    { label: 'Otro', value: eThirdGender.Otro }
  ];

  /** Estados para radio buttons */
  states_radio = [
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false }
  ];

  /** Tipos de persona para radio buttons */
  personTypes = [
    { label: 'Jurídica', value: ePersonType.juridica },
    { label: 'Natural', value: ePersonType.natural }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly thirdService: ThirdService,
    private readonly thirdServiceConfigurationService: ThirdServiceConfigurationService,
    private readonly router: Router,
    private readonly datePipe: DatePipe,
    private readonly messageService: MessageService,
    private readonly localStorageMethods: LocalStorageMethods,
    private readonly thirdFormService: ThirdFormService,
    private readonly thirdValidationService: ThirdValidationService,
    private readonly geographyHelper: GeographyHelperService,
    public readonly thirdValidationMessagesService: ThirdValidationMessagesService
  ) {
    this.entData = this.localStorageMethods.getIdEnterprise();
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadInitialData().then(() => {
      // Esperar a que se carguen los datos antes de procesar el RUT
      this.checkForRUTData();
    });
  }

  /**
   * Inicializa el formulario reactivo
   */
  private initializeForm(): void {
    this.createdThirdForm = this.fb.group({
      personType: [null, Validators.required],
      state: [true, Validators.required],
      thirdType: [null, Validators.required],
      typeId: [null, Validators.required],
      idNumber: [null, [Validators.required, Validators.min(1)]],
      verificationNumber: [null],
      names: [null],
      lastNames: [null],
      socialReason: [null],
      gender: [null],
      country: [null],
      province: [null],
      city: [{ value: null, disabled: true }], // Inicialmente deshabilitado
      address: [null, Validators.required],
      phoneNumber: [null, Validators.required],
      email: [null, [Validators.required, Validators.email]]
    });

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
        cityControl?.setValue(null);
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
        // Configurar validadores para persona natural
        namesControl?.setValidators([Validators.required]);
        lastNamesControl?.setValidators([Validators.required]);
        genderControl?.clearValidators();
        socialReasonControl?.clearValidators();

        // Limpiar campos específicos de persona jurídica
        socialReasonControl?.setValue(null);

        this.button2Checked = true;
        this.button1Checked = false;

        // Filtrar tipos de identificación para persona natural
        this.filteredTypeIds = this.thirdFormService.filterTypeIdsByPersonType(this.typeIds, 'NATURAL_PERSON');

        // Limpiar tipo de identificación ya que los disponibles cambian
        this.createdThirdForm.get('typeId')?.setValue(null);

        // Limpiar DV para persona natural
        this.thirdFormService.clearVerificationDigit(this.createdThirdForm);

        // Aplicar filtro de persona
        this.onPersonTypeChange();
      } else if (value === ePersonType.juridica) {
        // Configurar validadores para persona jurídica
        socialReasonControl?.setValidators([Validators.required]);
        namesControl?.clearValidators();
        lastNamesControl?.clearValidators();
        genderControl?.clearValidators();

        // Limpiar campos específicos de persona natural
        namesControl?.setValue(null);
        lastNamesControl?.setValue(null);
        genderControl?.setValue(null);

        this.button1Checked = true;
        this.button2Checked = false;

        // Filtrar tipos de identificación para persona jurídica
        this.filteredTypeIds = this.thirdFormService.filterTypeIdsByPersonType(this.typeIds, 'LEGAL_ENTITY');

        // Limpiar tipo de identificación ya que los disponibles cambian
        this.createdThirdForm.get('typeId')?.setValue(null);

        // Actualizar validaciones del número de identificación si hay tipo seleccionado
        const typeId = this.thirdFormService.getTypeId(this.createdThirdForm);
        const personType = this.thirdFormService.getPersonType(this.createdThirdForm);
        this.thirdValidationService.updateIdNumberValidations(
          this.createdThirdForm,
          typeId,
          personType
        );

        // Calcular DV si ya hay número de identificación y el tipo es NIT
        const idNumber = this.createdThirdForm.get('idNumber')?.value;
        if (this.thirdFormService.shouldCalculateDV(personType, typeId) && idNumber) {
          const dv = this.thirdFormService.calculateVerificationDigit(idNumber);
          this.thirdFormService.setVerificationDigit(this.createdThirdForm, dv);
        }

        // Aplicar filtro de persona
        this.onPersonTypeChange();
      }

      namesControl?.updateValueAndValidity();
      lastNamesControl?.updateValueAndValidity();
      socialReasonControl?.updateValueAndValidity();
      genderControl?.updateValueAndValidity();
    });

    // Calcular DV automáticamente cuando cambie el número de identificación (solo para persona jurídica con NIT)
    this.createdThirdForm.get('idNumber')?.valueChanges.subscribe(idNumber => {
      const personType = this.thirdFormService.getPersonType(this.createdThirdForm);
      const typeId = this.thirdFormService.getTypeId(this.createdThirdForm);

      if (this.thirdFormService.shouldCalculateDV(personType, typeId)) {
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
      const typeId = this.thirdFormService.getTypeId(this.createdThirdForm);
      const personType = this.thirdFormService.getPersonType(this.createdThirdForm);

      this.thirdValidationService.updateIdNumberValidations(
        this.createdThirdForm,
        typeId,
        personType
      );

      const idNumber = this.createdThirdForm.get('idNumber')?.value;
      if (this.thirdFormService.shouldCalculateDV(personType, typeId) && idNumber && idNumber > 0) {
        const dv = this.thirdFormService.calculateVerificationDigit(idNumber);
        this.thirdFormService.setVerificationDigit(this.createdThirdForm, dv);
      } else if (!this.thirdFormService.shouldCalculateDV(personType, typeId)) {
        // Limpiar DV si cambió a un tipo que no requiere cálculo automático
        this.thirdFormService.clearVerificationDigit(this.createdThirdForm);
      }
    });
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
   * Carga los datos iniciales necesarios
   */
  private async loadInitialData(): Promise<void> {
    try {
      await Promise.all([
        this.loadInitialThirdTypes(),
        this.loadInitialTypeIds(),
        this.loadCountries(),
        this.loadStates()
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
   * Carga inicial de tipos de identificación (sin búsqueda)
   */
  private getTypesID(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loadTypeIds();
      resolve();
    });
  }

  /**
   * Carga inicial de tipos de identificación
   */
  private loadInitialTypeIds(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loadTypeIds();
      // Pequeño delay para asegurar que se complete la carga
      setTimeout(() => resolve(), 100);
    });
  }

  /**
   * Carga inicial de tipos de tercero
   */
  private loadInitialThirdTypes(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loadThirdTypes();
      // Pequeño delay para asegurar que se complete la carga
      setTimeout(() => resolve(), 100);
    });
  }

  /**
   * Verifica si hay datos del RUT para prellenar el formulario
   */
  private checkForRUTData(): void {
    this.contendPDFRUT = this.thirdService.getInfoThirdRUT();
    if (this.contendPDFRUT) {
      this.infoThird = this.contendPDFRUT.split(';');
      this.prefillFormWithRUTData();

      // Mostrar notificación de éxito del procesamiento del PDF
      this.messageService.add({
        severity: 'success',
        summary: 'PDF procesado correctamente',
        detail: 'Los datos del RUT se han cargado en el formulario.'
      });
    }
  }

  /**
   * Prellena el formulario con datos del RUT
   */
  private prefillFormWithRUTData(): void {
    if (this.infoThird && this.infoThird.length >= 12) {
      // Determinar el tipo de persona
      const personTypeStr = this.infoThird[0]?.toLowerCase() || '';
      let personType = ePersonType.natural; // Por defecto natural

      if (personTypeStr.includes('jurídica') || personTypeStr.includes('juridica')) {
        personType = ePersonType.juridica;
      }

      // Buscar el tipo de identificación que coincida
      const typeIdStr = this.infoThird[1]?.trim() || '';
      let matchedTypeId = null;

      if (typeIdStr) {
        matchedTypeId = this.typeIds.find(t =>
          t.typeIdname?.toLowerCase().includes(typeIdStr.toLowerCase()) ||
          t.typeId?.toLowerCase() === typeIdStr.toLowerCase()
        );
      }

      // Buscar el código del departamento por su nombre
      const departmentName = this.infoThird[7]?.trim() || '';
      const departmentCode = this.findDepartmentCodeByName(departmentName);

      // Buscar el código del país por su nombre
      const countryName = this.infoThird[6]?.trim() || '';
      const countryCode = this.findCountryCodeByName(countryName) || 'COL';

      // Buscar el código de la ciudad por su nombre (se hará después de cargar las ciudades)
      const cityName = this.infoThird[8]?.trim() || '';

      this.createdThirdForm.patchValue({
        personType: personType,
        typeId: matchedTypeId,
        idNumber: parseInt(this.infoThird[2]) || 0,
        verificationNumber: this.infoThird[3] || null,
        lastNames: this.infoThird[4]?.trim() || null,
        names: this.infoThird[5]?.trim() || null,
        socialReason: personType === ePersonType.juridica ? this.infoThird[4]?.trim() : null,
        country: countryCode,
        province: departmentCode,
        address: this.infoThird[9]?.trim() || null,
        email: this.infoThird[10]?.trim() || null,
        phoneNumber: this.infoThird[11]?.trim() || null
      });

      // Cargar ciudades si hay departamento seleccionado
      if (departmentCode) {
        // Habilitar el control de ciudad
        this.createdThirdForm.get('city')?.enable();

        // Cargar ciudades y luego asignar la ciudad correspondiente
        this.geographyHelper.loadCitiesAsOptions(departmentCode, countryCode).subscribe({
          next: (cities) => {
            this.cities = cities;

            // Buscar el código de la ciudad por su nombre
            if (cityName) {
              const cityCode = this.findCityCodeByName(cityName, cities);
              if (cityCode) {
                this.createdThirdForm.patchValue({ city: cityCode });
              }
            }
          },
          error: (error) => {
            this.cities = [];
          }
        });
      }
    }
  }

  /**
   * Normaliza un string removiendo acentos y caracteres especiales
   * @param str String a normalizar
   * @returns String normalizado
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .normalize('NFD') // Descompone caracteres con acentos
      .replaceAll(/[\u0300-\u036f]/g, '') // Remueve los acentos
      .replaceAll(/[^a-z0-9\s]/g, ''); // Remueve caracteres especiales excepto espacios
  }

  /**
   * Busca el código del país por su nombre
   * @param countryName Nombre del país
   * @returns Código del país o null
   */
  private findCountryCodeByName(countryName: string): string | null {
    if (!countryName) return null;

    const normalized = this.normalizeString(countryName);
    const country = this.countries.find(c =>
      this.normalizeString(c.label) === normalized
    );

    if (country) {
      return country.value;
    }
    return null;
  }

  /**
   * Busca el código del departamento por su nombre
   * @param departmentName Nombre del departamento
   * @returns Código del departamento o null
   */
  private findDepartmentCodeByName(departmentName: string): string | null {
    if (!departmentName) return null;

    const normalized = this.normalizeString(departmentName);
    const department = this.states.find(state =>
      this.normalizeString(state.label) === normalized
    );

    if (department) {
      return department.value;
    }
    return null;
  }

  /**
   * Busca el código de la ciudad por su nombre
   * @param cityName Nombre de la ciudad
   * @param cities Lista de opciones de ciudades
   * @returns Código de la ciudad o null
   */
  private findCityCodeByName(cityName: string, cities: any[]): string | null {
    if (!cityName) return null;

    const normalized = this.normalizeString(cityName);
    const city = cities.find(c =>
      this.normalizeString(c.label) === normalized
    );

    if (city) {
      return city.value;
    }

    return null;
  }

  /**
   * Carga los tipos de tercero activos
   */
  private loadThirdTypes(): void {
    this.loadingThirdTypes = true;
    this.thirdServiceConfigurationService.getActiveThirdTypes(this.entData, 0, 50).subscribe({
      next: (response: any) => {
        this.thirdTypes = Array.isArray(response.content) ? response.content : [];
        this.loadingThirdTypes = false;
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar tipos de tercero'
        });
        this.loadingThirdTypes = false;
      }
    });
  }

  /**
   * Carga los tipos de identificación activos
   */
  private loadTypeIds(): void {
    this.loadingTypeIds = true;
    this.thirdServiceConfigurationService.getActiveTypeIds(this.entData, 0, 50).subscribe({
      next: (response: any) => {
        this.typeIds = Array.isArray(response.content) ? response.content : [];
        // Aplicar filtro por tipo de persona
        this.applyPersonTypeFilter();
        this.loadingTypeIds = false;
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar tipos de identificación'
        });
        this.loadingTypeIds = false;
      }
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
   * Maneja el cambio de tipo de persona para actualizar el filtro de tipos de identificación
   */
  onPersonTypeChange(): void {
    // Reaplicar el filtro cuando cambia el tipo de persona
    this.applyPersonTypeFilter();
  }

  /**
   * Carga los países desde el backend
   */
  private loadCountries(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.geographyHelper.loadCountriesAsOptions().subscribe({
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
   * Carga los departamentos/estados desde el backend
   * Por defecto carga los de Colombia (COL)
   */
  private loadStates(countryCode: string = 'COL'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.geographyHelper.loadDepartmentsAsOptions(countryCode).subscribe({
        next: (departments) => {
          this.states = departments;
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
    this.geographyHelper.loadCitiesAsOptions(stateCode, countryCode).subscribe({
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
  onStateChange(stateCode: string): void {
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
   * Envía el formulario para crear el tercero
   */
  OnSubmit(): void {
    this.submitted = true;

    if (this.createdThirdForm.valid) {
      const formData = this.createdThirdForm.getRawValue();
      const { thirdType, ...formFields } = formData;

      // Preparar datos para enviar al backend con códigos geográficos
      const newThird: any = {
        ...this.thirdData,
        ...formFields,
        thirdTypes: thirdType ? [thirdType] : [],
        entId: this.entData,
        countryCode: formData.country,
        stateCode: formData.province,
        cityCode: formData.city,
        country: undefined,
        province: undefined,
        city: undefined
      };

      this.thirdService.createThird(newThird).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Registro exitoso',
            detail: 'Tercero creado correctamente'
          });

          // Limpiar datos del RUT si existen
          this.thirdService.clearInfoThirdRUT();

          this.router.navigate(['/gen-masters/third-parties/list']);
        },
        error: (error: any) => {
          // Extraer el mensaje de error más específico disponible
          const errorMessage = error.error?.message || error.message || 'Error al crear el tercero';

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
   * Cancela la creación y regresa a la lista
   */
  onCancel(): void {
    this.thirdService.clearInfoThirdRUT();
    this.router.navigate(['/gen-masters/third-parties/list']);
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