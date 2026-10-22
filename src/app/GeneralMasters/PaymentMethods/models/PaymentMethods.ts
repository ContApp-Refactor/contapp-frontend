export interface PaymentMethod {
  id?: number;
  name: string;
  accountingAccount: string; // Código completo para compatibilidad (código - descripción)
  accountingAccountId: number | null; // Solo el ID de la cuenta contable
  status: boolean;
  requiresBankAccount: boolean;
  isDeleted?: boolean;
  idEnterprise: string;
}

// Interface simplificada para cuentas contables auxiliares en dropdown
export interface AccountingAccountOption {
  label: string;
  value: number; // ID de la cuenta contable
  code: string; // Código de la cuenta para mostrar
}
