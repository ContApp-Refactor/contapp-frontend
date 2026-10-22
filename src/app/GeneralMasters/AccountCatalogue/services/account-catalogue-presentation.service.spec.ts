import { AccountCataloguePresentationService } from './account-catalogue-presentation.service';
import { Account } from '../models/ChartAccount';

describe('AccountCataloguePresentationService', () => {
  let service: AccountCataloguePresentationService;

  const accounts: Account[] = [
    { id: 1, code: '11050501', description: 'Caja', status: true, nature: 'Debito', financialStatus: 'Estado de Situacion Financiero', classification: 'Activo Corriente' },
    { id: 2, code: '22050101', description: 'Proveedor A', status: false, nature: 'Credito', financialStatus: 'Estado de Situacion Financiero', classification: 'Pasivo Corriente' },
    { id: 3, code: '22050102', description: 'Proveedor B', status: true, nature: 'Credito', financialStatus: 'Estado de Situacion Financiero', classification: 'Pasivo Corriente' },
  ];

  beforeEach(() => {
    service = new AccountCataloguePresentationService();
  });

  it('filters only active auxiliary accounts for new operations', () => {
    const active = service.filterActiveAuxiliaryAccounts(accounts);
    expect(active.map((item) => item.id)).toEqual([1, 3]);
  });

  it('keeps preserved inactive account visible in edit forms', () => {
    const selectable = service.filterSelectableAuxiliaryAccounts(accounts, 2);
    expect(selectable.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('marks inactive preserved account in label', () => {
    expect(service.formatAccountingAccountLabel(accounts[1], true)).toContain('(Inactiva)');
    expect(service.formatAccountingAccountLabel(accounts[0], true)).not.toContain('(Inactiva)');
  });
});
