export interface EnterpriseDetails{
    id?:string;
    name: string;
    nit: string;
    phone: string;
    branch: string;
    email: string;
    logo: string;
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
    dv: string;
    /**
     * El DTO del backend (`EnterpriseByIdResponse.DV`) se serializa como `DV`
     * en mayúsculas (Jackson no descapitaliza iniciales dobles). Se acepta aquí
     * para poder leerlo como `dv`, que es como lo usan todos los componentes.
     */
    DV?: string;
    mainActivity?:number;
    secondaryActivity?: number;

    // Campos específicos para persona jurídica
    legalName?: string;

    // Campos específicos para persona natural
    ownerName?: string;
    lastNames?: string;
    inventoryConfigurationType:string;
}
