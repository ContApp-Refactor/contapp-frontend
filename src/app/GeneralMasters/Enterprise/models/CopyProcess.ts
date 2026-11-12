export interface CopyProcess {
  idProceso: string;
  tipo: 'BACKUP' | 'DUPLICATE' | 'RESTORE';
  estado: string;
  empresaOrigen: string;
  empresaDestino: string;
  iniciadoPor: string;
  iniciadoEn?: string;
  snapshotCorte?: string;
  finalizadoEn?: string;
  backupRef?: string | null;
  faseActual?: number;
  errorResumen?: string | null;
  /** Aditivos (ZIP v2); pueden faltar en procesos viejos. */
  moduloActual?: string | null;
  modulosCompletados?: string[] | null;
  modulosTotales?: number | null;
  progreso?: number | null;
}

/** Respuesta de GET /enterprises/copy/modules. */
export interface BackupModuleInfo {
  key: string;
  order: number;
  schemaVersion: number;
  requires: string[];
}

/** Opciones opcionales al restaurar. */
export interface RestoreOptions {
  nombreDestino?: string;
  nitDestino?: string;
  skipUnknownModules?: boolean;
}
