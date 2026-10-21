export interface ProductType {
  id: number; 
  name: string; 
  description: string;
  enterpriseId: string;
  state: boolean; // Removido el opcional para garantizar que siempre tenga valor
  sellable: boolean;      // Vendible (factura de venta)
  purchasable: boolean;   // Comprable (factura de compra)
  inventoryable: boolean; // Inventariable (uso en kardex)
}

export interface ProductTypeList {
  id: number; 
  name: string;
  description: string;
  enterpriseId: string;
  state: boolean; // Removido el opcional para consistencia
  sellable: boolean;      // Vendible (factura de venta)
  purchasable: boolean;   // Comprable (factura de compra)
  inventoryable: boolean; // Inventariable (uso en kardex)
}
  