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
}
