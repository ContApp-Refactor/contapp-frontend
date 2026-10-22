import { Account } from '../../../GeneralMasters/AccountCatalogue/models/ChartAccount';
import { PaymentMethod } from '../../../GeneralMasters/PaymentMethods/models/PaymentMethods';

export function buildActiveAccountIdSet(accounts: Account[]): Set<number> {
  return new Set(
    accounts
      .filter((account) => account.id !== undefined && account.status !== false)
      .map((account) => account.id as number),
  );
}

/** Métodos de pago usables en operaciones nuevas: cuenta contable activa o método histórico preservado. */
export function filterSelectablePaymentMethods(
  methods: PaymentMethod[],
  activeAccountIds: Set<number>,
  preserveMethodId?: number | null,
): PaymentMethod[] {
  return methods.filter((method) => {
    if (preserveMethodId != null && method.id === preserveMethodId) return true;
    if (!method.accountingAccountId) return false;
    return activeAccountIds.has(method.accountingAccountId);
  });
}
