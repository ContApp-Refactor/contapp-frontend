/** Resolución de nombres de proveedores desde Terceros (solo visualización). */
export function buildThirdPartyNameMap(thirds: Array<{
  thId?: number;
  socialReason?: string;
  names?: string;
  lastNames?: string;
}>): Map<number, string> {
  return new Map(
    (thirds || []).map((third) => {
      const name =
        (third.socialReason as string) ||
        [third.names, third.lastNames].filter(Boolean).join(' ') ||
        `Proveedor ${third.thId}`;
      return [Number(third.thId), String(name)] as [number, string];
    }),
  );
}

export function resolveSupplierName(map: Map<number, string>, supplierId: number): string {
  return map.get(Number(supplierId)) || `Proveedor ${supplierId}`;
}

/** Normaliza el valor del filtro de proveedor (dropdown/autocomplete) a un id numérico. */
export function resolveSupplierFilterId(raw: unknown): number | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'object') {
    const candidate =
      (raw as { value?: unknown }).value ??
      (raw as { id?: unknown }).id ??
      (raw as { thId?: unknown }).thId;
    return resolveSupplierFilterId(candidate);
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildThirdPartyIdentificationMap(thirds: Array<{
  thId?: number;
  idNumber?: number;
  verificationNumber?: number;
}>): Map<number, string> {
  return new Map(
    (thirds || []).map((third) => {
      const id = Number(third.thId);
      const base = third.idNumber != null ? String(third.idNumber) : '';
      const label = base
        ? `${base}${third.verificationNumber != null ? `-${third.verificationNumber}` : ''}`
        : '—';
      return [id, label] as [number, string];
    }),
  );
}

export function resolveSupplierIdentification(
  map: Map<number, string>,
  supplierId: number,
): string {
  return map.get(Number(supplierId)) ?? '—';
}
