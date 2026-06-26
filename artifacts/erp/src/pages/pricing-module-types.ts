export type ProductOption = { id: number; name: string; price: number };

export type PricingIngredient = {
  id: number;
  name: string;
  type: "comprado" | "fabricado" | "produto";
  packageContent: number;
  unit: string;
  packagePrice: number;
  yieldPercent: number;
  unitCost: number;
  active: boolean;
};

export type TechnicalSheet = {
  id: number;
  productId: number;
  name: string;
  totalYield: number;
  totalCost: number;
  unitCost: number;
  preparationMode: string;
  items: Array<{
    id: number;
    ingredientId: number;
    ingredientName: string;
    netQuantity: number;
    grossQuantity: number;
    unit: string;
    yieldPercent: number;
    ingredientCost: number;
    note: string;
  }>;
};

export type GeneralCost = {
  id: number;
  name: string;
  type: "monthly_fixed" | "variable";
  value: number;
  applyToDirectSale: boolean;
  applyToMarketplace: boolean;
  active: boolean;
};

export function fmtCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtPercent(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
