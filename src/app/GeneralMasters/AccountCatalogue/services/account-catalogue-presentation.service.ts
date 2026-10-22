import { Injectable } from '@angular/core';
import { Account } from '../models/ChartAccount';

@Injectable({
  providedIn: 'root'
})
export class AccountCataloguePresentationService {

  /**
   * Obtiene el texto del estado del elemento
   */
  formatState(status: boolean | undefined): string {
    return status ? 'Activo' : 'Inactivo';
  }

  /**
   * Obtiene la severidad del estado para el componente p-tag
   */
  getStateSeverity(status: boolean | undefined): 'success' | 'danger' {
    return status ? 'success' : 'danger';
  }

  /**
   * Verifica si el elemento está activo
   */
  isActive(status: boolean | undefined): boolean {
    return !!status;
  }

  /**
   * Obtiene el tooltip para el toggle basado en el estado
   */
  getToggleTooltip(status: boolean | undefined): string {
    return this.formatState(status);
  }

  /**
   * Verifica si una cuenta está vinculada a impuestos
   */
  isAccountLinked(accountCode: string, listRefundAccount: string[], listDepositAccount: string[]): boolean {
    return listRefundAccount.includes(accountCode) || listDepositAccount.includes(accountCode);
  }

  /** Cuentas auxiliares activas aptas para operaciones nuevas. */
  filterActiveAuxiliaryAccounts(accounts: Account[]): Account[] {
    return accounts.filter((account) => account.id !== undefined && account.status !== false);
  }

  /**
   * Cuentas seleccionables en formularios: activas + la cuenta histórica preservada (p. ej. edición).
   */
  filterSelectableAuxiliaryAccounts(accounts: Account[], preserveAccountId?: number | null): Account[] {
    return accounts.filter((account) => {
      if (account.id === undefined) return false;
      if (account.status !== false) return true;
      return preserveAccountId != null && account.id === preserveAccountId;
    });
  }

  formatAccountingAccountLabel(account: Account, markInactive = false): string {
    const label = `${account.code} - ${account.description}`;
    return markInactive && account.status === false ? `${label} (Inactiva)` : label;
  }
}