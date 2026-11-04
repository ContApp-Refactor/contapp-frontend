import { firstValueFrom } from 'rxjs';
import { ReturnAvailabilityLine, SaleReturn } from '../models/billing-sale-return.model';
import { BillingSaleReturnApi } from '../services/billing-sale-return.api';
import { isUnknownOutcome } from '../services/idempotency-key.store';

// Devolución completa de una factura: "anular" una factura emitida = devolver todo lo que quede disponible.
// Sirve a venta y a compra (el adaptador de devoluciones ya resuelve el tipo por la factura).

/** La factura no tiene nada más para devolver (ya se devolvió por completo). */
export class NothingToReturnError extends Error {
  constructor() {
    super('Esta factura ya fue devuelta por completo: no queda nada disponible para devolver.');
    this.name = 'NothingToReturnError';
  }
}

const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Líneas con todo lo disponible por línea de la factura (descarta las que ya no tienen cantidad). */
export function fullReturnLines(availability: ReturnAvailabilityLine[]): { lineNo: number; cantidad: number }[] {
  return availability.filter((a) => a.available > 0).map((a) => ({ lineNo: a.lineNo, cantidad: a.available }));
}

// Borradores de devolución que ya tiene la factura (se resuelven antes de crear otro)
const draftsOf = async (api: BillingSaleReturnApi, invoiceId: string): Promise<SaleReturn[]> =>
  (await firstValueFrom(api.listByInvoice(invoiceId))).filter((r) => r.status === 'BORRADOR');

// Contenido original de un borrador de devolución que el usuario tenía a medias (para restaurarlo si falla la emisión)
const originalContent = (draft: SaleReturn) => ({
  date: draft.date,
  reason: draft.reason ?? '',
  lines: (draft.lines ?? [])
    .filter((l) => l.sourceLineNo != null && l.cantidadDevuelta > 0)
    .map((l) => ({ lineNo: l.sourceLineNo as number, cantidad: l.cantidadDevuelta })),
});

/**
 * Crea y emite una devolución por TODAS las cantidades disponibles de la factura.
 * El motivo se envía como motivo de la devolución. Si la emisión falla, el borrador creado por esta operación se
 * elimina para no dejar devoluciones a medias.
 *
 * Borradores huérfanos: si la factura ya tenía un borrador de devolución se REUTILIZA (se sobrescribe con la
 * devolución completa) y los sobrantes se eliminan; así no quedan borradores ocultos. Si la emisión falla, el borrador
 * reutilizado NO se borra: se RESTAURA su contenido original (líneas, motivo y fecha) con la versión vigente, porque era
 * trabajo a medias del usuario. Límite: si el POST de creación falla SIN respuesta (timeout con el servidor ya
 * confirmado) no se conoce el id; se intenta localizar y borrar el borrador consultando la factura (y se libera la clave
 * de idempotencia para que el reintento no haga replay de un borrador ya borrado), pero si esa consulta también falla
 * puede quedar un borrador, que se retoma desde el botón "Devolución" de la factura.
 */
export async function returnWholeInvoice(
  api: BillingSaleReturnApi,
  invoiceId: string,
  reason: string,
): Promise<SaleReturn> {
  const availability = await firstValueFrom(api.getAvailability(invoiceId));
  const lines = fullReturnLines(availability);
  if (lines.length === 0) throw new NothingToReturnError();

  const [existing, ...extras] = await draftsOf(api, invoiceId);
  for (const extra of extras) await firstValueFrom(api.deleteDraft(extra.id, extra.version));
  const original = existing ? originalContent(existing) : null; // antes de sobrescribirlo

  let draft: SaleReturn;
  try {
    draft = await firstValueFrom(
      api.saveDraft({
        id: existing?.id,
        version: existing?.version,
        invoiceId,
        date: todayIso(),
        reason: reason.trim(),
        lines,
      }),
    );
  } catch (e) {
    if (!existing) {
      // Solo si se pudo consultar y limpiar se libera la clave; si no, queda para que el reintento haga replay (sin duplicar)
      if (await discardUnknownDrafts(api, invoiceId)) api.forgetPendingCreation?.(invoiceId);
    } else if (isUnknownOutcome(e)) {
      // El PUT pudo aplicarse sin que llegara la respuesta: se devuelve su contenido original (sin verificar versión)
      await restoreDraft(api, invoiceId, existing.id, null, original!);
    }
    throw e;
  }
  try {
    return await firstValueFrom(api.emit(draft.id, draft.version));
  } catch (e) {
    if (existing) await restoreDraft(api, invoiceId, existing.id, draft.version, original!);
    else await firstValueFrom(api.deleteDraft(draft.id)).catch(() => undefined);
    throw e;
  }
}

// Devuelve el borrador reutilizado a su contenido original; si no se puede (p. ej. la emisión sí se confirmó) no hay más que hacer
const restoreDraft = async (
  api: BillingSaleReturnApi,
  invoiceId: string,
  id: string,
  version: number | null | undefined,
  original: ReturnType<typeof originalContent>,
): Promise<void> => {
  try {
    await firstValueFrom(api.saveDraft({ id, version, invoiceId, ...original }));
  } catch {
    // La excepción original de la emisión es la que se informa
  }
};

// El POST pudo crear el borrador aunque no llegó la respuesta: como antes no había ninguno, cualquiera que aparezca es de este intento.
// Devuelve true si pudo consultar y borrar todo lo que apareció.
const discardUnknownDrafts = async (api: BillingSaleReturnApi, invoiceId: string): Promise<boolean> => {
  try {
    for (const orphan of await draftsOf(api, invoiceId)) {
      await firstValueFrom(api.deleteDraft(orphan.id, orphan.version));
    }
    return true;
  } catch {
    return false; // Sin poder consultar no hay nada más que hacer (ver el límite documentado arriba)
  }
};
