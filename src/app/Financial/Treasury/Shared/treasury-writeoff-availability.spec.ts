import { hasActiveWriteOffForInvoice, isBlockingWriteOffStatus } from './treasury-writeoff-availability';
import { PayableWriteOff } from './treasury-api.models';

describe('treasury-writeoff-availability', () => {
  const invoiceId = 11;

  it('treats DRAFT and POSTING as blocking', () => {
    expect(isBlockingWriteOffStatus('DRAFT')).toBeTrue();
    expect(isBlockingWriteOffStatus('POSTING')).toBeTrue();
    expect(isBlockingWriteOffStatus('VOIDING')).toBeTrue();
    expect(isBlockingWriteOffStatus('POSTED')).toBeFalse();
    expect(isBlockingWriteOffStatus('FAILED')).toBeFalse();
    expect(isBlockingWriteOffStatus('VOIDED')).toBeFalse();
    expect(isBlockingWriteOffStatus('VOID_FAILED')).toBeFalse();
  });

  it('detects active write-off for invoice from list', () => {
    const writeOffs: PayableWriteOff[] = [
      { id: 1, status: 'DRAFT', total: 100, details: [{ supplierId: 7, invoiceId, amount: 100 }] },
    ];
    expect(hasActiveWriteOffForInvoice(writeOffs, invoiceId)).toBeTrue();
    expect(hasActiveWriteOffForInvoice(writeOffs, 99)).toBeFalse();
  });

  it('does not block when only finalized write-offs exist', () => {
    const writeOffs: PayableWriteOff[] = [
      { id: 2, status: 'POSTED', total: 100, details: [{ supplierId: 7, invoiceId, amount: 100 }] },
      { id: 3, status: 'FAILED', total: 50, details: [{ supplierId: 7, invoiceId, amount: 50 }] },
      { id: 4, status: 'VOIDED', total: 25, details: [{ supplierId: 7, invoiceId, amount: 25 }] },
    ];
    expect(hasActiveWriteOffForInvoice(writeOffs, invoiceId)).toBeFalse();
  });
});
