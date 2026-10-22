export const NO_PAYMENT_METHODS_CONFIGURED_MESSAGE =
  'La empresa no tiene métodos de pago configurados. Registre y active métodos de pago en '
  + 'Maestros Generales → Métodos de Pago antes de pagar obligaciones en Tesorería.';

export const NO_SELECTABLE_PAYMENT_METHODS_MESSAGE =
  'No hay métodos de pago listos para usar. Verifique que cada método tenga una cuenta contable '
  + 'activa en el catálogo de cuentas.';

/** @deprecated use paymentMethodsAvailabilityMessage */
export const NO_ACTIVE_PAYMENT_METHODS_MESSAGE = NO_PAYMENT_METHODS_CONFIGURED_MESSAGE;

export const NO_AVAILABLE_BANK_ACCOUNTS_MESSAGE =
  'No hay cuentas bancarias activas para este método. Configure cuentas bancarias en '
  + 'Maestros Generales → Banco y Cuentas Bancarias.';

export function paymentMethodsAvailabilityMessage(
  configuredCount: number,
  selectableCount: number,
): string {
  if (selectableCount > 0) {
    return '';
  }
  if (configuredCount === 0) {
    return NO_PAYMENT_METHODS_CONFIGURED_MESSAGE;
  }
  return NO_SELECTABLE_PAYMENT_METHODS_MESSAGE;
}
