// Interfaz genérica para opciones de dropdowns
export interface DropdownOption {
    label: string;
    value: any; 
}

// Interfaz para el proveedor (equivalente al cliente pero para gastos)
export interface Supplier {
    id: number;
    name: string;
    accountsPayableAccount: {
        id: number;
        code: string; 
        name: string;
    };
}

// Interfaz para las facturas pendientes de un proveedor (cuentas por pagar)
export interface PurchaseInvoice {
    id: number;
    factCode: string;
    expirationDate: Date;
    pendingValue: number;
    selectedForPayment?: boolean; 
    amountToPay?: number;
    payableAccountId?: number;
    payableAccountCode?: string;
}

// Interfaz para la vista de lista de recibos de gastos
export interface ExpenseReceiptView {
    id: number;
    receiptCode: string;
    issueDate: Date;
    thirdPartyId: number;
    supplierName: string;
    /** Etiqueta mostrada en UI */
    status: string;
    /** Estado crudo del voucher (DRAFT, POSTED, VOIDED, …) */
    statusKey?: string;
    totalAmount: number;
    accountingEntryId?: number;
}

export interface ReceiptFilterOption {
    label: string;
    value: string | number;
    supplierId?: number;
}
