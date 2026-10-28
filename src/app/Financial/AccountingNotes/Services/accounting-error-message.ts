type ErrorPayload = {
  status?: unknown;
  error?: unknown;
  message?: unknown;
  detail?: unknown;
  errors?: unknown;
};

/** Extracts a readable backend message and falls back to a user-facing status message. */
export function accountingErrorMessage(error: unknown, fallback: string): string {
  const response = isRecord(error) ? error : {};
  const status = typeof response['status'] === 'number' ? response['status'] : undefined;

  // Do not expose server/internal details for connectivity, authentication,
  // authorization or 5xx failures, even if the response contains a message.
  if (status === 0) return 'No fue posible conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.';
  if (status === 401) return 'Tu sesión venció. Inicia sesión nuevamente.';
  if (status === 403) return 'No tienes permisos para realizar esta acción.';
  if (status !== undefined && status >= 500) return 'El servicio presentó un error. Inténtalo de nuevo más tarde.';

  const payload = response['error'];
  const backendMessage = messageFromPayload(payload);
  if (backendMessage) return backendMessage;

  if (status === 404) return 'No se encontró la información solicitada. Actualiza la pantalla e inténtalo de nuevo.';
  if (status === 409) return 'La operación entra en conflicto con el estado actual del registro. Actualiza la pantalla e inténtalo de nuevo.';
  return fallback;
}

function messageFromPayload(payload: unknown): string | undefined {
  if (typeof payload === 'string') {
    const value = payload.trim();
    return value && !/^\s*</.test(value) ? value : undefined;
  }
  if (!isRecord(payload)) return undefined;

  for (const key of ['message', 'detail'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return conciseBackendText(value);
  }

  const fieldErrors = payload['errors'];
  if (Array.isArray(fieldErrors)) {
    const messages = fieldErrors.filter((value): value is string => typeof value === 'string' && !!value.trim());
    if (messages.length) return conciseBackendText(messages.join(' '));
  }
  if (isRecord(fieldErrors)) {
    const messages = Object.values(fieldErrors).flatMap(value =>
      Array.isArray(value) ? value : [value],
    ).filter((value): value is string => typeof value === 'string' && !!value.trim());
    if (messages.length) return conciseBackendText(messages.join(' '));
  }

  // Some services return the actual explanation as `error`; avoid generic
  // HTTP labels such as "Bad Request" when the user-facing fallback is better.
  const errorText = payload['error'];
  if (typeof errorText === 'string' && !/^(bad request|internal server error|not found)$/i.test(errorText.trim())) {
    return conciseBackendText(errorText);
  }
  return undefined;
}

function conciseBackendText(value: string): string {
  // Spring validation errors may include the full rejected request (including
  // every accounting line). Prefer its concise validation message for toasts.
  const validationMessages = [...value.matchAll(/default message \[([^\]]+)\]/gi)];
  const concise = validationMessages[validationMessages.length - 1]?.[1]?.trim() ?? value.trim();
  return concise.length > 500 ? `${concise.slice(0, 497)}...` : concise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
