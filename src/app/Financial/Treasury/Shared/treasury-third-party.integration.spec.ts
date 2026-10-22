import { buildThirdPartyNameMap, resolveSupplierFilterId, resolveSupplierName } from './treasury-third-party.integration';

describe('treasury-third-party.integration', () => {
  it('builds a name map from third parties', () => {
    const map = buildThirdPartyNameMap([
      { thId: 7, socialReason: 'Proveedor Alfa S.A.S.' },
      { thId: 8, names: 'Juan', lastNames: 'Pérez' },
    ]);
    expect(map.get(7)).toBe('Proveedor Alfa S.A.S.');
    expect(map.get(8)).toBe('Juan Pérez');
  });

  it('falls back to Proveedor {id} when name is missing', () => {
    const map = buildThirdPartyNameMap([]);
    expect(resolveSupplierName(map, 99)).toBe('Proveedor 99');
  });

  it('normalizes supplier filter values from dropdown selections', () => {
    expect(resolveSupplierFilterId(null)).toBeUndefined();
    expect(resolveSupplierFilterId('78')).toBe(78);
    expect(resolveSupplierFilterId({ value: 78, label: '78 — Proveedor' })).toBe(78);
    expect(resolveSupplierFilterId({ id: 78 })).toBe(78);
    expect(resolveSupplierFilterId({ thId: 78 })).toBe(78);
    expect(resolveSupplierFilterId('abc')).toBeUndefined();
  });
});
