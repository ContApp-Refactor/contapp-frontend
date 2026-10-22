import {
  NO_PAYMENT_METHODS_CONFIGURED_MESSAGE,
  NO_SELECTABLE_PAYMENT_METHODS_MESSAGE,
  paymentMethodsAvailabilityMessage,
} from './treasury-payment-messages';

describe('treasury-payment-messages', () => {
  it('returns empty when selectable payment methods exist', () => {
    expect(paymentMethodsAvailabilityMessage(3, 2)).toBe('');
  });

  it('guides to configure payment methods when none exist', () => {
    expect(paymentMethodsAvailabilityMessage(0, 0)).toBe(NO_PAYMENT_METHODS_CONFIGURED_MESSAGE);
  });

  it('guides to fix accounting accounts when methods exist but are not selectable', () => {
    expect(paymentMethodsAvailabilityMessage(2, 0)).toBe(NO_SELECTABLE_PAYMENT_METHODS_MESSAGE);
  });
});
