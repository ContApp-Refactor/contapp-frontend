import { PayableWriteOff, WriteOffStatus } from './treasury-api.models';

/** Estados no finalizados que impiden crear otra baja sobre la misma obligación. */
export const BLOCKING_WRITE_OFF_STATUSES: ReadonlySet<WriteOffStatus> = new Set([
  'DRAFT',
  'POSTING',
  'VOIDING',
]);

export function isBlockingWriteOffStatus(status?: string | null): boolean {
  return status != null && BLOCKING_WRITE_OFF_STATUSES.has(status as WriteOffStatus);
}

export function writeOffBlocksInvoice(writeOff: PayableWriteOff, invoiceId: number): boolean {
  if (!isBlockingWriteOffStatus(writeOff.status)) {
    return false;
  }
  return (writeOff.details ?? []).some((detail) => Number(detail.invoiceId) === invoiceId);
}

export function hasActiveWriteOffForInvoice(writeOffs: PayableWriteOff[], invoiceId: number): boolean {
  return writeOffs.some((writeOff) => writeOffBlocksInvoice(writeOff, invoiceId));
}
