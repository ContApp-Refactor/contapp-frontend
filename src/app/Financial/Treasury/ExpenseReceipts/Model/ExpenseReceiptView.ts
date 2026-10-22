import { AccountingEntryLine } from "./AccountingEntryLine";
import { PaidInvoiceLineView } from "../../Shared/treasury-purchase-invoice-lines";

export interface ExpenseReceiptDetailView {
    invoiceId: number;
    sourceInvoiceId?: number;
    amountPaid: number;
    invoiceCode: string;
    invoiceValue: number;
    retentionsApplied: number;
    payableAccountCode: string;
    remainingBalance: number;
    productLines?: PaidInvoiceLineView[];
}

export interface ExpenseReceiptDetailsView {
    id: number;
    receiptCode: string;
    issueDate: Date;
    executionDateTime?: Date;
    thirdPartyId: number;
    supplierName: string;
    supplierIdentification?: string;
    paymentMethodName: string;
    paymentMethodRequiresBankAccount?: boolean;
    bankAccountId?: number;
    bankAccountLabel?: string;
    status: string;
    statusKey?: string;
    grossAmount: number;
    retentionsAmount: number;
    netAmount: number;
    totalAmount: number;
    observations: string;
    isDirectExpense: boolean;
    accountingEntryId?: number;
    accountingEntryCode?: string;
    accountingStatusLabel?: string;
    scheduleId?: number;
    scheduleExecutionDate?: string;
    details: ExpenseReceiptDetailView[];
    accountingEntry?: AccountingEntryLine[];
}
