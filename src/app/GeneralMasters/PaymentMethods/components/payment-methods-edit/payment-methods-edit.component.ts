import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { PaymentMethodsServiceService } from '../../services/payment-methods-service.service';
import { ChartAccountService } from '../../../AccountCatalogue/services/chart-account.service';
import { AccountCataloguePresentationService } from '../../../AccountCatalogue/services/account-catalogue-presentation.service';
import { Account } from '../../../AccountCatalogue/models/ChartAccount';
import { AccountingAccountOption, PaymentMethod } from '../../models/PaymentMethods';

@Component({
  selector: 'app-payment-methods-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, SelectModule, TooltipModule],
  templateUrl: './payment-methods-edit.component.html',
  styleUrl: './payment-methods-edit.component.css'
})
export class PaymentMethodsEditComponent implements OnInit {
  form: FormGroup;
  id!: number;
  accountingAccountsOptions: AccountingAccountOption[] = [];
  private allAuxiliaryAccounts: Account[] = [];
  initialValue: any = {};
  isEditMode: boolean = true; // Siempre es true en este componente de edición

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly messageService: MessageService,
    private readonly service: PaymentMethodsServiceService,
    private readonly chartAccountService: ChartAccountService,
    private readonly accountPresentation: AccountCataloguePresentationService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      accountingAccount: [null, []],
      requiresBankAccount: [false]
    });
  }

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    const entData = localStorage.getItem('entData');
    const enterpriseId = entData ? JSON.parse(entData).id : '';
    if (!enterpriseId || !this.id) return;

    // Cargar cuentas auxiliares para el dropdown primero
    this.loadAccountingAccounts(enterpriseId, () => {
      // Una vez cargadas las cuentas, cargar los datos del método de pago
      this.loadPaymentMethodData(enterpriseId);
    });
  }

  private loadPaymentMethodData(enterpriseId: string): void {
    this.service.findById(this.id, enterpriseId).subscribe({
      next: (paymentMethod: PaymentMethod) => {
        // Obtener el ID de la cuenta contable
        let accountId: number | null = paymentMethod.accountingAccountId;
        
        // Si accountingAccountId es null, intentar encontrar la cuenta por el código
        if (!accountId && paymentMethod.accountingAccount) {
          const accountCode = paymentMethod.accountingAccount.split(' - ')[0];
          const foundAccount = this.accountingAccountsOptions.find(option => option.code === accountCode);
          accountId = foundAccount?.value || null;
        }

        this.form.patchValue({
          name: paymentMethod.name,
          accountingAccount: accountId,
          requiresBankAccount: paymentMethod.requiresBankAccount
        });

        this.refreshAccountingAccountOptions(accountId);

        // Guardar valores iniciales para comparar cambios
        this.initialValue = {
          name: paymentMethod.name,
          accountingAccount: accountId,
          requiresBankAccount: paymentMethod.requiresBankAccount
        };
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el método de pago'
        });
      }
    });
  }

  private loadAccountingAccounts(enterpriseId: string, callback?: () => void): void {
    this.chartAccountService.getListAuxiliaryAccounts(enterpriseId).subscribe({
      next: (accounts: Account[]) => {
        this.allAuxiliaryAccounts = accounts;
        this.refreshAccountingAccountOptions();

        if (callback) {
          callback();
        }
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
  }

  private refreshAccountingAccountOptions(preserveAccountId?: number | null): void {
    const preserveId = preserveAccountId ?? this.form.get('accountingAccount')?.value ?? null;
    this.accountingAccountsOptions = this.accountPresentation
      .filterSelectableAuxiliaryAccounts(this.allAuxiliaryAccounts, preserveId)
      .map((account: Account) => ({
        label: this.accountPresentation.formatAccountingAccountLabel(account, account.status === false),
        value: account.id!,
        code: account.code,
      }));
  }

  goBack() {
    this.router.navigate(['/gen-masters/payment-methods/list']);
  }

  hasChanges(): boolean {
    const currentName = this.form.get('name')?.value;
    const currentAccountingAccount = this.form.get('accountingAccount')?.value;
    const currentRequiresBankAccount = this.form.get('requiresBankAccount')?.value;

    return this.initialValue.name !== currentName ||
           this.initialValue.accountingAccount !== currentAccountingAccount ||
           this.initialValue.requiresBankAccount !== currentRequiresBankAccount;
  }

  onSubmit() {
    if (this.form.invalid || !this.hasChanges()) {
      this.form.markAllAsTouched();
      return;
    }

    const entData = localStorage.getItem('entData');
    const enterpriseId = entData ? JSON.parse(entData).id : '';
    const formValues = this.form.value;
    const selectedAccount = this.allAuxiliaryAccounts.find((account) => account.id === formValues.accountingAccount);
    if (
      selectedAccount?.status === false &&
      formValues.accountingAccount !== this.initialValue.accountingAccount
    ) {
      this.messageService.add({
        severity: 'error',
        summary: 'Cuenta no válida',
        detail: 'No puede asignar una cuenta contable inactiva a un método de pago.',
      });
      return;
    }

    const payload = {
      id: this.id,
      idEnterprise: enterpriseId,
      name: formValues.name,
      accountingAccountId: formValues.accountingAccount,
      requiresBankAccount: Boolean(formValues.requiresBankAccount)
    };

    this.service.update(payload as any).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Actualización exitosa',
          detail: 'Método de pago actualizado correctamente.'
        });
        this.goBack();
      },
      error: (err) => {
        // Verificar si es error específico de método de pago en uso
        const errorCode = err?.error?.code || err?.code || '';
        if (errorCode === 'PAYMENT_METHOD_IN_USE') {
          this.messageService.add({
            severity: 'info',
            summary: 'Información',
            detail: err?.error?.message || 'No se puede editar el método de pago porque tiene movimientos contables'
          });
          this.goBack(); // Navegar de vuelta a la lista
          return;
        }

        // Verificar si el mensaje de error contiene la cadena específica de movimientos contables
        const errorMessage = err?.error?.message || err?.message || '';
        if (errorMessage.includes('No se puede editar el método de pago') && errorMessage.includes('movimientos contables')) {
          this.messageService.add({
            severity: 'info',
            summary: 'Información',
            detail: errorMessage
          });
          this.goBack(); // Navegar de vuelta a la lista
          return;
        }

        if (err?.status === 409) {
          const msg: string = err?.error?.message || err?.error?.detail || '';
          const nameMatch = msg.match(/nombre\s+'([^']+)'/i) || msg.match(/nombre\s*[:=]\s*([A-Za-zÀ-ÿ0-9\s]+)/i);
          if (nameMatch) {
            const n = (nameMatch[1] || nameMatch[0])?.toString().replace(/^[^']*'|'/g,'');
            this.messageService.add({
              severity: 'error',
              summary: 'Registro Duplicado',
              detail: `El método de pago "${n}" ya existe.`
            });
            return;
          }
          this.messageService.add({
            severity: 'error',
            summary: 'Duplicado',
            detail: 'Ya existe un método de pago con el mismo nombre.'
          });
          return;
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo actualizar el método de pago'
        });
      }
    });
  }
}
