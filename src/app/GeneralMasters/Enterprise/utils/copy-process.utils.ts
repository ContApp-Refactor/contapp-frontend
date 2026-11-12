import { CopyProcess } from '../models/CopyProcess';

/** Texto fijo (fallback) de lo que incluye la copia de seguridad completa. */
export const BACKUP_INCLUDES_TEXT =
  'Incluye todo lo de la empresa: configuración, terceros, PUC, impuestos, productos, inventario, contabilidad y tesorería.';

/** Módulos por defecto si GET /copy/modules falla. */
export const FALLBACK_MODULE_LABELS: string[] = [
  'Configuración',
  'Terceros',
  'PUC',
  'Impuestos',
  'Productos',
  'Inventario',
  'Contabilidad',
  'Tesorería',
];

const MODULE_LABELS: Record<string, string> = {
  enterprise: 'Empresa',
  configuration: 'Configuración',
  thirds: 'Terceros',
  puc: 'PUC',
  taxes: 'Impuestos',
  products: 'Productos',
  'inventory.replicas': 'Inventario (réplicas de producto)',
  'inventory.kardex': 'Kardex',
  'inventory.kardex.movements': 'Kardex (movimientos)',
  'inventory.peps': 'PEPS',
  'inventory.peps.movements': 'PEPS (movimientos)',
  'accounting.ledger': 'Contabilidad',
  'accounting.treasury': 'Tesorería',
  financial: 'Financiero',
  auxiliary: 'Auxiliares',
};

/** Nombre legible de un módulo; si no se conoce, devuelve la clave tal cual. */
export function moduleLabel(key: string | null | undefined): string {
  if (!key) return '';
  return MODULE_LABELS[key] ?? key;
}

export type CopyErrorKind = 'NIT_EXISTS' | 'UNSUPPORTED_MODULE' | 'PURGE_UNSUPPORTED' | 'OTHER';

export interface ParsedCopyError {
  status?: number;
  code?: string;
  message: string;
  kind: CopyErrorKind;
}

/**
 * Lee `err.error.message` / `err.error.code` (ErrorResponse del back) y
 * clasifica el error. 409 ENTERPRISE_NIT_ALREADY_EXISTS, 422
 * BACKUP_UNSUPPORTED_MODULE y 422 BACKUP_PURGE_UNSUPPORTED (un módulo no sabe
 * borrar sus datos: no se puede restaurar sobre una empresa existente) tienen
 * tratamiento propio en la UI.
 */
export function parseCopyError(err: any, fallback: string): ParsedCopyError {
  const status: number | undefined = err?.status;
  const body = err?.error;
  const code: string | undefined = typeof body === 'object' && body ? body.code : undefined;
  const backMessage: string | undefined =
    typeof body === 'object' && body ? body.message : typeof body === 'string' ? body : undefined;

  let kind: CopyErrorKind = 'OTHER';
  if (code === 'ENTERPRISE_NIT_ALREADY_EXISTS') kind = 'NIT_EXISTS';
  else if (code === 'BACKUP_PURGE_UNSUPPORTED') kind = 'PURGE_UNSUPPORTED';
  else if (code === 'BACKUP_UNSUPPORTED_MODULE') kind = 'UNSUPPORTED_MODULE';

  return { status, code, kind, message: backMessage?.trim() || fallback };
}

/**
 * Clasifica el texto de `errorResumen` de un proceso que terminó en ERROR
 * (el back no manda `code` en el proceso, solo texto). Heurística tolerante.
 */
export function classifyProcessError(errorResumen: string | null | undefined): CopyErrorKind {
  const text = (errorResumen ?? '').toLowerCase();
  if (text.includes('enterprise_nit_already_exists') || /ya tienes una empresa con nit/.test(text)) {
    return 'NIT_EXISTS';
  }
  // Antes que UNSUPPORTED_MODULE: su mensaje también contiene "no soporta".
  if (text.includes('backup_purge_unsupported') || /no soporta borrar sus datos/.test(text)) {
    return 'PURGE_UNSUPPORTED';
  }
  if (text.includes('backup_unsupported_module') || /no soporta|no puede restaurar/.test(text)) {
    return 'UNSUPPORTED_MODULE';
  }
  return 'OTHER';
}

/** Texto de avance por módulo; tolera procesos viejos sin esos campos. */
export function progressDetail(p: Partial<CopyProcess> | null | undefined): string {
  if (!p) return '';
  const parts: string[] = [];
  if (p.moduloActual) parts.push(`Procesando: ${moduleLabel(p.moduloActual)}`);
  const total = p.modulosTotales;
  if (typeof total === 'number' && total > 0) {
    const done = Array.isArray(p.modulosCompletados) ? p.modulosCompletados.length : 0;
    parts.push(`${done}/${total} módulos`);
  }
  return parts.join(' · ');
}

/** Progreso 0-100 real si el back lo informa; si no, undefined. */
export function realProgress(p: Partial<CopyProcess> | null | undefined): number | undefined {
  const v = p?.progreso;
  return typeof v === 'number' && !isNaN(v) ? Math.max(0, Math.min(100, v)) : undefined;
}

/**
 * SUPUESTO: el back no expone la versión del ZIP en el proceso. Un proceso
 * con campos de módulo (moduloActual/modulosTotales/modulosCompletados) fue
 * generado por el back v2; un proceso viejo no los trae (-> v1). Ya no condiciona
 * la restauración sobre empresa existente (permitida para v1 y v2).
 */
export function isV2Process(p: Partial<CopyProcess> | null | undefined): boolean {
  if (!p) return false;
  return (
    !!p.moduloActual ||
    (typeof p.modulosTotales === 'number' && p.modulosTotales > 0) ||
    (Array.isArray(p.modulosCompletados) && p.modulosCompletados.length > 0)
  );
}

/**
 * Detecta si un ZIP subido es v2 buscando `manifest.json` en el directorio
 * central (al final del archivo; v1 solo trae enterprise.json). Si no se puede
 * leer, devuelve false (se mantiene el comportamiento v1 y el back valida).
 */
export async function isV2Zip(file: File): Promise<boolean> {
  try {
    const tailSize = Math.min(file.size, 256 * 1024);
    const buf = await file.slice(file.size - tailSize).arrayBuffer();
    const text = new TextDecoder('latin1').decode(new Uint8Array(buf));
    return text.includes('manifest.json');
  } catch {
    return false;
  }
}
