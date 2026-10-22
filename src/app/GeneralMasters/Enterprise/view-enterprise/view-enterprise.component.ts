import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { Router } from '@angular/router';
import {
  LocalStorageMethods,
  EntData,
} from '../../../Shared/Methods/local-storage.method';
import { EnterpriseService } from '../services/enterprise.service';
import { EnterpriseDetails } from '../models/EnterpriseDetails';
import { DialogModule } from 'primeng/dialog';
import { TaxService } from '../../../GeneralMasters/Taxes/services/tax.service';

@Component({
  selector: 'app-view-enterprise',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule],
  templateUrl: './view-enterprise.component.html',
  styleUrl: './view-enterprise.component.css',
})
export class ViewEnterpriseComponent implements OnInit {
  entData: EntData | null = null;
  enterpriseData: EnterpriseDetails | null = null;
  loading: boolean = false;
  showSuccessModal: boolean = false;
  showArchiveConfirm: boolean = false;
  showArchiveSuccessModal: boolean = false;

  localStorageMethods: LocalStorageMethods = new LocalStorageMethods();

  // Controla la visibilidad del modal
  showCompleteModal: boolean = false;

  // (Opcional - futuro) controla si la empresa está completa
  // Por ahora lo dejamos en false para que siempre se muestre el mensaje
  enterpriseCompleta: boolean = false;

  // (Opcional - futuro) porcentaje dinámico
  completionPercentage: number = 0;

  // valor objetivo (lo puedes cambiar luego dinámicamente)
  targetPercentage: number = 80;

  // catálogo de responsabilidades tributarias.
  taxLiabilitiesCatalog: any[] = [];

  // Controla si se muestra la tarjeta de empresa incompleta
  showIncompleteCard: boolean = false;

  // valores del círculo
  radius: number = 45;
  circumference: number = 2 * Math.PI * this.radius;

  // offset dinámico (esto mueve el borde)
  strokeDashoffset: number = this.circumference;

  constructor(
    private router: Router,
    private enterpriseService: EnterpriseService,
    private taxService: TaxService,
  ) {}

    ngOnInit(): void {
    this.loadTaxLiabilitiesCatalog();
    this.loadEnterpriseData();
  }

  loadEnterpriseData(): void {
    this.entData = this.localStorageMethods.loadEnterpriseData();

    if (this.entData?.id) {
      this.loading = true;
      this.enterpriseService.getEnterpriseById(this.entData.id).subscribe({
        next: (data: EnterpriseDetails) => {
          this.enterpriseData = data;
          this.configureEnterpriseCompletionState();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar datos de la empresa:', error);
          this.loading = false;
        },
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/enterprise/list']);
  }

  goToEdit(): void {
    this.router.navigate(['/enterprise/edit']);
  }

  /** ==================== GETTERS DE DATOS ==================== */

  // Tipo de empresa
  getEnterpriseTypeName(): string {
    if (!this.enterpriseData?.enterpriseType) return 'No disponible';
    const type = this.enterpriseData.enterpriseType;
    return typeof type === 'object' ? type.name : type;
  }

  // Tipo de persona
  getPersonTypeName(): string {
    if (!this.enterpriseData?.personType) return 'No disponible';
    const type = this.enterpriseData.personType;
    return typeof type === 'object' ? type.type : type;
  }

  // Razón social (business name)
  getBusinessName(): string {
    if (!this.enterpriseData?.personType) return 'No disponible';
    const person = this.enterpriseData.personType;
    return typeof person === 'object' && person.bussinessName
      ? person.bussinessName
      : 'No disponible';
  }

  // Tipo de contribuyente
  getTaxPayerTypeName(): string {
    if (!this.enterpriseData?.taxPayerType) return 'No disponible';
    const type = this.enterpriseData.taxPayerType;
    return typeof type === 'object' ? type.name : type;
  }

  // Responsabilidades tributarias
  getTaxLiabilitiesNames(): string {
    if (
      !this.enterpriseData?.taxLiabilities ||
      this.enterpriseData.taxLiabilities.length === 0
    ) {
      return 'No disponible';
    }

    const names = this.enterpriseData.taxLiabilities
      .map((liability: any) => {
        const liabilityId =
          typeof liability === 'object'
            ? Number(liability.id)
            : Number(liability);

        const taxFromCatalog = this.taxLiabilitiesCatalog.find(
          (tax: any) => Number(tax.id) === liabilityId,
        );

        if (taxFromCatalog) {
          return taxFromCatalog.description || taxFromCatalog.name || null;
        }

        if (typeof liability === 'object') {
          return liability.description || liability.name || null;
        }

        return null;
      })
      .filter((name: string | null) => !!name);

    return names.length > 0 ? names.join(', ') : 'No disponible';
  }

  // Localización
  getLocationData(field: string): string {
    if (!this.enterpriseData?.location) return 'No disponible';
    const location = this.enterpriseData.location;
    switch (field) {
      case 'country':
        return typeof location.country === 'object'
          ? location.country.name
          : location.country;
      case 'department':
        return typeof location.department === 'object'
          ? location.department.name
          : location.department;
      case 'city':
        return typeof location.city === 'object'
          ? location.city.name
          : location.city;
      case 'address':
        return location.address || 'No disponible';
      default:
        return 'No disponible';
    }
  }

  // Materia
  /**
   * Tree la materia asociada a la empresa para mostrarla en la vista. Si no hay materia, devuelve "No disponible".
   * @param field
   */
  getSubjectData(): string {
    if (
      !this.enterpriseData?.subjects ||
      this.enterpriseData.subjects.length === 0
    ) {
      return 'No disponible';
    }

    return this.enterpriseData.subjects
      .map((subject) => subject.name)
      .filter((name) => !!name)
      .join(', ');
  }

  // ==================== MÉTODOS PARA MODAL COMPLETAR EMPRESA ====

  // Abrir modal
  openCompleteModal(): void {
    this.showCompleteModal = true;
  }

  // Cerrar modal
  closeCompleteModal(): void {
    this.showCompleteModal = false;
  }

  // Ir a crear impuestos
  goToCreateTaxes(): void {
    this.showSuccessModal = false;
    this.router.navigate(['/gen-masters/taxes/create']);
  }

  openArchiveConfirmation(): void {
    this.showArchiveConfirm = true;
  }

  cancelArchive(): void {
    this.showArchiveConfirm = false;
  }

  confirmArchive(): void {
    const enterpriseId = this.entData?.id;
    if (!enterpriseId) return;

    this.enterpriseService.archiveEnterprise(enterpriseId).subscribe({
      next: () => {
        this.showArchiveConfirm = false;
        this.showArchiveSuccessModal = true;
      },
      error: (error) => {
        console.error('Error al archivar la empresa:', error);
        this.showArchiveConfirm = false;
      },
    });
  }

  closeArchiveSuccess(): void {
    this.showArchiveSuccessModal = false;
  }

  // Completar empresa
  completeEnterprise(): void {
    this.closeCompleteModal();
    this.goToEdit();
  }

  // ==================== ANIMACIÓN PROGRESO ====================
  animateProgress(): void {
    const duration = 1200; // duración total (ms)
    const steps = 60; // suavidad
    const increment = this.targetPercentage / steps;
    const intervalTime = duration / steps;

    let current = 0;

    const interval = setInterval(() => {
      current += increment;

      if (current >= this.targetPercentage) {
        current = this.targetPercentage;
        clearInterval(interval);
      }

      // actualizar porcentaje (texto)
      this.completionPercentage = Math.round(current);

      // calcular offset del círculo
      const progressRatio = current / 100;
      this.strokeDashoffset = this.circumference * (1 - progressRatio);
    }, intervalTime);
  }

  private getEnterpriseId(): string {
    const entData = this.localStorageMethods.loadEnterpriseData();
    return entData?.id || '';
  }

  private loadTaxLiabilitiesCatalog(): void {
    const enterpriseId = this.getEnterpriseId();

    if (!enterpriseId) {
      this.taxLiabilitiesCatalog = [];
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

          this.taxLiabilitiesCatalog = content.map((tax: any) => ({
            id: Number(tax.id),
            code: tax.code,
            description: tax.description,
            name: `${tax.code} - ${tax.description}`,
          }));
        },
        error: (error) => {
          console.error('Error al cargar catálogo de impuestos:', error);
          this.taxLiabilitiesCatalog = [];
        },
      });
  }




    private hasTaxLiabilitiesAssigned(): boolean {
    return !!this.enterpriseData?.taxLiabilities?.length;
  }

  private configureEnterpriseCompletionState(): void {
    if (this.hasTaxLiabilitiesAssigned()) {
      this.showIncompleteCard = false;
      this.enterpriseCompleta = true;
      this.targetPercentage = 100;
      this.completionPercentage = 100;
      this.strokeDashoffset = 0;
      return;
    }

    this.showIncompleteCard = true;
    this.enterpriseCompleta = false;
    this.targetPercentage = 97;
    this.completionPercentage = 0;
    this.strokeDashoffset = this.circumference;

    setTimeout(() => {
      this.animateProgress();
    }, 200);
  }
}
