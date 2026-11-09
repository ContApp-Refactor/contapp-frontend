import { Subject } from '../../Subjects/models/subjects';

export interface EnterpriseDetails {
  id?: string;
  name: string;
  nit: string;
  phone: string;
  branch: string;
  email: string;
  logo?: string | null;
  /* Descomentar cuando este implementado
    taxLiabilities: TaxLiability[];
    taxPayerType: TaxPayerType;
    enterpriseType: EnterpriseType;
    personType: PersonType;
    location: LocationDetails;
    */
  taxLiabilities: any[];
  taxPayerType: any;
  enterpriseType: any;
  personType: any;
  location: any;
  state?: string;
  inventoryMethods?: string;
  dv: string;
  mainActivity?: number;
  secondaryActivity?: number;

  // Campos específicos para persona jurídica
  legalName?: string;

  // Campos específicos para persona natural
  ownerName?: string;
  lastNames?: string;
  // En la respuesta del back: lista de materias { id (UUID), code, name }
  subjects?: Subject[];
}

// Cuerpo de crear/editar: las materias viajan como ids (UUID).
// Crear: ausente = sin materias. Editar: ausente/null = no modifica, [] = quita todas.
export type EnterpriseRequest = Omit<EnterpriseDetails, 'subjects'> & {
  subjects?: string[] | null;
};
