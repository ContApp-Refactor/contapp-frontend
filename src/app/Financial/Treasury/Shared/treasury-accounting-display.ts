export interface AccountingMovementViewRow {
  accountId?: number;
  accountCode: string;
  accountName: string;
  detail: string;
  debit: number;
  credit: number;
  thirdPartyId?: number;
}

export interface AccountingEntryViewHeader {
  documentTypeLabel?: string;
  voucherNumber?: string;
  supplierLabel?: string;
  entryCode?: string;
  entryDate?: string;
  entryStatus?: string;
  entryDescription?: string;
}

export interface AccountingEntryView {
  header: AccountingEntryViewHeader;
  movements: AccountingMovementViewRow[];
}

export interface AccountCatalogueRef {
  id?: number;
  code: string;
  description: string;
  status?: boolean;
}

export interface AccountCatalogueNode extends AccountCatalogueRef {
  children?: AccountCatalogueNode[];
}

export function flattenAccountCatalogueRefs(accounts: AccountCatalogueNode[]): AccountCatalogueRef[] {
  const flat: AccountCatalogueRef[] = [];
  const walk = (nodes: AccountCatalogueNode[]) => {
    nodes.forEach((node) => {
      if (node.id != null) {
        flat.push({
          id: node.id,
          code: node.code,
          description: node.description,
          status: node.status,
        });
      }
      if (node.children?.length) {
        walk(node.children);
      }
    });
  };
  walk(accounts);
  return flat;
}

export function buildAccountCatalogueLookup(accounts: AccountCatalogueRef[]): Map<number, { code: string; description: string }> {
  const lookup = new Map<number, { code: string; description: string }>();
  accounts.forEach((account) => {
    if (account.id == null) {
      return;
    }
    lookup.set(Number(account.id), {
      code: String(account.code),
      description: String(account.description),
    });
  });
  return lookup;
}

export function resolveAccountFromLookup(
  accountRef: unknown,
  lookup: Map<number, { code: string; description: string }>,
): { accountId?: number; accountCode: string; accountName: string } {
  const numericId = Number(accountRef);
  const isNumericId = accountRef != null && accountRef !== '' && !Number.isNaN(numericId);
  if (isNumericId && lookup.has(numericId)) {
    const account = lookup.get(numericId)!;
    return {
      accountId: numericId,
      accountCode: account.code,
      accountName: account.description,
    };
  }

  const raw = String(accountRef ?? '').trim();
  if (raw) {
    const byCode = [...lookup.values()].find((account) => account.code === raw);
    if (byCode) {
      return {
        accountCode: byCode.code,
        accountName: byCode.description,
      };
    }
    if (!isNumericId || raw.length > 4) {
      return {
        accountCode: raw,
        accountName: '—',
      };
    }
    return {
      accountId: numericId,
      accountCode: '—',
      accountName: `Cuenta ${raw}`,
    };
  }

  return {
    accountCode: '—',
    accountName: '—',
  };
}

function hasExplicitAccountLabel(code: string, name: string): boolean {
  if (!code || !name) {
    return false;
  }
  const normalizedName = name.trim();
  return normalizedName !== '—' && normalizedName !== `Cuenta ${code}`;
}

export function resolveMovementAccountDisplay(
  movement: Record<string, unknown>,
  accountLookup: Map<number, { code: string; description: string }>,
): { accountId?: number; accountCode: string; accountName: string } {
  // Accounting currently exposes the persisted internal account id as `account`.
  // Prefer that authoritative reference (or `accountId`) over optional display labels.
  const accountIdRaw = movement['accountId'] ?? movement['account'];
  const accountId = accountIdRaw != null && accountIdRaw !== ''
    ? Number(accountIdRaw)
    : undefined;
  if (accountId != null && !Number.isNaN(accountId) && accountLookup.has(accountId)) {
    const account = accountLookup.get(accountId)!;
    return {
      accountId,
      accountCode: account.code,
      accountName: account.description,
    };
  }

  const explicitCode = String(movement['accountCode'] ?? '').trim();
  const explicitName = String(
    movement['accountName'] ?? movement['accountDescription'] ?? movement['accountLabel'] ?? '',
  ).trim();
  if (hasExplicitAccountLabel(explicitCode, explicitName)) {
    return {
      accountId: accountId != null && !Number.isNaN(accountId) ? accountId : undefined,
      accountCode: explicitCode,
      accountName: explicitName,
    };
  }

  const accountRef = accountId ?? movement['accountCode'];
  return resolveAccountFromLookup(accountRef, accountLookup);
}

export function mapAccountingMovementsForView(
  movements: unknown[],
  accountLookup: Map<number, { code: string; description: string }>,
): AccountingMovementViewRow[] {
  return (movements as Record<string, unknown>[]).map((movement) => {
    const resolved = resolveMovementAccountDisplay(movement, accountLookup);
    const thirdPartyRaw = movement['thirdPartyId'];
    const thirdPartyId = thirdPartyRaw != null ? Number(thirdPartyRaw) : undefined;
    return {
      accountId: resolved.accountId,
      accountCode: resolved.accountCode,
      accountName: resolved.accountName,
      detail: String(movement['description'] ?? ''),
      debit: Number(movement['debit'] ?? 0),
      credit: Number(movement['credit'] ?? 0),
      thirdPartyId: Number.isNaN(thirdPartyId) ? undefined : thirdPartyId,
    };
  });
}

export function accountingTotalsBalanced(debitTotal: number, creditTotal: number, tolerance = 0.01): boolean {
  return Math.abs(debitTotal - creditTotal) <= tolerance;
}

export function buildAccountingEntryView(
  entry: Record<string, unknown> | null | undefined,
  movements: AccountingMovementViewRow[],
  headerContext: Partial<AccountingEntryViewHeader> = {},
): AccountingEntryView {
  const entryCode = entry?.['code'];
  const entryDate = entry?.['date'];
  const entryStatus = entry?.['status'];
  const entryDescription = entry?.['description'];
  return {
    header: {
      documentTypeLabel: headerContext.documentTypeLabel,
      voucherNumber: headerContext.voucherNumber,
      supplierLabel: headerContext.supplierLabel,
      entryCode: headerContext.entryCode ?? (entryCode != null ? String(entryCode) : undefined),
      entryDate: headerContext.entryDate ?? (entryDate != null ? String(entryDate) : undefined),
      entryStatus: headerContext.entryStatus ?? (entryStatus != null ? String(entryStatus) : undefined),
      entryDescription: headerContext.entryDescription ?? (entryDescription != null ? String(entryDescription) : undefined),
    },
    movements,
  };
}
