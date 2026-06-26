export type CostAmountType = "currency" | "percent";
export type SaleChannel = "direct" | "marketplace";

export type PricingCost = {
  name: string;
  type: "fixed" | "variable" | "monthly_fixed";
  amountType: CostAmountType;
  amount: number;
  applyToDirectSale?: boolean;
  applyToMarketplace?: boolean;
  active?: boolean;
};

export function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function calculateUnitCost(packagePrice: number, packageContent: number) {
  const content = safeNumber(packageContent);
  if (content <= 0) return 0;
  return safeNumber(packagePrice) / content;
}

export function calculateGrossQuantity(netQuantity: number, yieldPercent = 100) {
  const net = safeNumber(netQuantity);
  const yieldRate = safeNumber(yieldPercent, 100) / 100;
  if (yieldRate <= 0) return net;
  return net / yieldRate;
}

export function calculateIngredientCost(netQuantity: number, unitCost: number, yieldPercent = 100) {
  return calculateGrossQuantity(netQuantity, yieldPercent) * safeNumber(unitCost);
}

export function calculateTechnicalSheetCost(costs: number[], totalYield = 1) {
  const totalCost = costs.reduce((total, cost) => total + safeNumber(cost), 0);
  const units = Math.max(safeNumber(totalYield, 1), 1);
  return {
    totalCost,
    unitCost: totalCost / units,
  };
}

export function filterCostsByChannel(costs: PricingCost[], channel: SaleChannel) {
  return costs.filter((cost) => {
    if (cost.active === false) return false;
    if (channel === "direct") return cost.applyToDirectSale !== false;
    return cost.applyToMarketplace !== false;
  });
}

export function splitCosts(costs: PricingCost[]) {
  return costs.reduce(
    (acc, cost) => {
      const value = safeNumber(cost.amount);
      if (cost.type === "monthly_fixed") acc.monthlyFixed += value;
      if (cost.amountType === "percent") acc.percent += value;
      if (cost.type !== "monthly_fixed" && cost.amountType === "currency") acc.fixedCurrency += value;
      return acc;
    },
    { fixedCurrency: 0, percent: 0, monthlyFixed: 0 },
  );
}

export function calculateFixedCostAllocation(monthlyFixedCost: number, monthlyUnits: number) {
  const units = safeNumber(monthlyUnits);
  if (units <= 0) return 0;
  return safeNumber(monthlyFixedCost) / units;
}

export function calculateProductTotalCost(baseCost: number, fixedCurrencyCosts: number, salePrice: number, percentCosts: number, fixedCostAllocated = 0) {
  return safeNumber(baseCost) + safeNumber(fixedCurrencyCosts) + safeNumber(fixedCostAllocated) + (safeNumber(salePrice) * (safeNumber(percentCosts) / 100));
}

export function calculateCMV(totalCost: number, salePrice: number) {
  const price = safeNumber(salePrice);
  if (price <= 0) return 0;
  return (safeNumber(totalCost) / price) * 100;
}

export function calculateContributionMargin(salePrice: number, totalCost: number) {
  const price = safeNumber(salePrice);
  const value = price - safeNumber(totalCost);
  return {
    value,
    percent: price > 0 ? (value / price) * 100 : 0,
  };
}

export function calculateSuggestedPriceByCMV(costWithoutSalePercent: number, targetCMVPercent: number, salePercentCosts = 0) {
  const target = safeNumber(targetCMVPercent) / 100;
  const salePercent = safeNumber(salePercentCosts) / 100;
  const denominator = target - salePercent;
  if (denominator <= 0) return 0;
  return safeNumber(costWithoutSalePercent) / denominator;
}

export function calculateSuggestedPriceByMargin(costWithoutSalePercent: number, targetMarginPercent: number, salePercentCosts = 0) {
  const margin = safeNumber(targetMarginPercent) / 100;
  const salePercent = safeNumber(salePercentCosts) / 100;
  const denominator = 1 - margin - salePercent;
  if (denominator <= 0) return 0;
  return safeNumber(costWithoutSalePercent) / denominator;
}

export function calculateMarketplacePrice(directPrice: number, marketplacePercent: number) {
  const denominator = 1 - (safeNumber(marketplacePercent) / 100);
  if (denominator <= 0) return 0;
  return safeNumber(directPrice) / denominator;
}

export function calculateNetProfit(salePrice: number, totalCost: number, fixedCostAllocated = 0) {
  const profit = safeNumber(salePrice) - safeNumber(totalCost) - safeNumber(fixedCostAllocated);
  const price = safeNumber(salePrice);
  return {
    value: profit,
    percent: price > 0 ? (profit / price) * 100 : 0,
  };
}

export function cmvStatus(cmvPercent: number) {
  if (cmvPercent <= 30) return "excellent";
  if (cmvPercent <= 40) return "healthy";
  if (cmvPercent <= 50) return "attention";
  return "critical";
}
