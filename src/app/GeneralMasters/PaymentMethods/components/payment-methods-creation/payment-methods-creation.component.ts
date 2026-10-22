import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { PaymentMethodsServiceService } from '../../services/payment-methods-service.service';
import { ChartAccountService } from '../../../AccountCatalogue/services/chart-account.service';
import { AccountCataloguePresentationService } from '../../../AccountCatalogue/services/account-catalogue-presentation.service';
import { Account } from '../../../AccountCatalogue/models/ChartAccount';
import { AccountingAccountOption } from '../../models/PaymentMethods';


@Component({
  selector: 'app-payment-methods-creation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, SelectModule],
  templateUrl: './payment-methods-creation.component.html',
  styleUrl: './payment-methods-creation.component.css'
})
export class PaymentMethodsCreationComponent {
  form: FormGroup;
  accountingAccountsOptions: AccountingAccountOption[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly messageService: MessageService,
    private readonly service: PaymentMethodsServiceService,
    private readonly chartAccountService: ChartAccountService,
    private readonly accountPresentation: AccountCataloguePresentationService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      accountingAccount: [null, [Validators.required]],
      requiresBankAccount: [false]
    });
  }

  ngOnInit(): void {
    const entData = localStorage.getItem('entData');
    const enterpriseId = entData ? JSON.parse(entData).id : '';

    if (enterpriseId) {
      // Cargar cuentas auxiliares activas para el dropdown
      this.chartAccountService.getListAuxiliaryAccounts(enterpriseId).subscribe({
        next: (accounts: Account[]) => {
          this.accountingAccountsOptions = this.accountPresentation
            .filterActiveAuxiliaryAccounts(accounts)
            .map((account: Account) => ({
              label: this.accountPresentation.formatAccountingAccountLabel(account),
              value: account.id!,
              code: account.code,
            }));
        },
        error: (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error de conexión',
            detail: 'No se pudieron cargar las cuentas contables. Verifique la conexión con el servidor.',
            life: 5000
          });
        }
      });
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Empresa no encontrada',
        detail: 'No se pudo identificar la empresa actual.',
        life: 5000
      });
    }
  }

  goBack() {
    this.router.navigate(['/gen-masters/payment-methods/list']);
  }



  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const entData = localStorage.getItem('entData');
    const enterpriseId = entData ? JSON.parse(entData).id : '';
    const selectedAccountId = this.form.value.accountingAccount;
    if (!this.accountingAccountsOptions.some((option) => option.value === selectedAccountId)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Cuenta no válida',
        detail: 'Seleccione una cuenta contable activa del catálogo.',
      });
      return;
    }

    const payload = {
      idEnterprise: enterpriseId,
      name: this.form.value.name,
      accountingAccountId: selectedAccountId,
      status: true,
      requiresBankAccount: Boolean(this.form.value.requiresBankAccount)
    };

    this.service.create(payload as any).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Registro exitoso',
          detail: 'Método de pago creado correctamente.'
        });
        this.goBack();
      },
      error: (err) => {
        if (err?.status === 409) {
          const msg: string = err?.error?.message || err?.error?.detail || '';
          const nameMatch = msg.match(/nombre\s+'([^']+)'/i) || msg.match(/nombre\s*[:=]\s*([A-Za-zÀ-ÿ0-9\s]+)/i);
          if (nameMatch) {
            const n = (nameMatch[1] || nameMatch[0])?.toString().replace(/^[^']*'|'/g,'');
            this.messageService.add({
              severity: 'error',
              summary: 'Registro duplicado',
              detail: `El método de pago "${n}" ya existe.`
            });
            return;
          }
          this.messageService.add({
            severity: 'error',
            summary: 'Registro duplicado',
            detail: 'Ya existe un método de pago con el mismo nombre.'
          });
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo crear el método de pago'
        });
      }
    });
  }
}
