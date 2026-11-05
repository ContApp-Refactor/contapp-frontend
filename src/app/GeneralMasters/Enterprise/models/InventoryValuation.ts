export type InventoryConfigurationType = 'PEPS' | 'WEIGHTED_AVERAGE';

export const DEFAULT_INVENTORY_CONFIGURATION_TYPE: InventoryConfigurationType =
  'WEIGHTED_AVERAGE';

export const INVENTORY_VALUATION_OPTIONS: {
  name: string;
  value: InventoryConfigurationType;
}[] = [
  { name: 'Promedio ponderado', value: 'WEIGHTED_AVERAGE' },
  { name: 'PEPS', value: 'PEPS' },
];
