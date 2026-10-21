export interface Category {
    id?: number; 
    name: string; 
    description: string;
    enterpriseId: string;
    state: boolean; 
    taxes?: number[]; // Campo adicional para envío backendal 
    // Cuentas contables
    inventoryId: number; 
    costId: number;
    saleId: number;
    returnId: number;            // Devolución en venta (PP7 HU2: antes "devolución" genérica)
    productTypeId?: number | null;  // Tipo de producto amarrado (PP7 HU2)
    returnPurchaseId?: number | null; // Cuenta de devolución en compra (PP7 HU2)
}
export interface CategoryList {
    id: number; 
    name: string; 
    description: string;
    enterpriseId: string;
    state: boolean;
    inventoryName: string; 
    costName: string;
    saleName: string;
    returnName: string;
}