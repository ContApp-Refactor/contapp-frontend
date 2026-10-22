import { Account } from '../../../GeneralMasters/AccountCatalogue/models/ChartAccount';
import { PaymentMethod } from '../../../GeneralMasters/PaymentMethods/models/PaymentMethods';
import {
  buildActiveAccountIdSet,
  filterSelectablePaymentMethods,
} from './treasury-account.integration';

describe('treasury-account.integration', () => {
  const accounts: Account[] = [
    { id: 10, code: '11100501', description: 'Banco', status: true, nature: 'Debito', financialStatus: 'Estado de Situacion Financiero', classification: 'Activo Corriente' },
    { id: 20, code: '22050101', description: 'CxP', status: false, nature: 'Credito', financialStatus: 'Estado de Situacion Financiero', classification: 'Pasivo Corriente' },
    { id: 30, code: '22050102', description: 'CxP 2', status: true, nature: 'Credito', financialStatus: 'Estado de Situacion Financiero', classification: 'Pasivo Corriente' },
  ];

  const methods: PaymentMethod[] = [
    { id: 1, name: 'Transferencia', accountingAccount: '11100501 - Banco', accountingAccountId: 10, status: true, requiresBankAccount: true, idEnterprise: 'ent-1' },
    { id: 2, name: 'Efectivo inactivo', accountingAccount: '22050101 - CxP', accountingAccountId: 20, status: true, requiresBankAccount: false, idEnterprise: 'ent-1' },
    { id: 3, name: 'Cheque', accountingAccount: '22050102 - CxP 2', accountingAccountId: 30, status: true, requiresBankAccount: false, idEnterprise: 'ent-1' },
  ];

  it('builds active account id set excluding inactive accounts', () => {
    expect([...buildActiveAccountIdSet(accounts)]).toEqual([10, 30]);
  });

  it('excludes payment methods linked to inactive accounts for new operations', () => {
    const activeIds = buildActiveAccountIdSet(accounts);
    const selectable = filterSelectablePaymentMethods(methods, activeIds);
    expect(selectable.map((item) => item.id)).toEqual([1, 3]);
  });

  it('preserves historical payment method even if its account was deactivated', () => {
    const activeIds = buildActiveAccountIdSet(accounts);
    const selectable = filterSelectablePaymentMethods(methods, activeIds, 2);
    expect(selectable.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});
