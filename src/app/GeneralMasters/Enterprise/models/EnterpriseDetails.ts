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
  subjects?: {
    id?: string;
    code?: string;
    name?: string;
  }[];
}
