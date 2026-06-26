import { boolean, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ingredientsTable = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("comprado"),
  packageContent: numeric("package_content", { precision: 10, scale: 3 }).notNull().default("1"),
  unit: text("unit").notNull().default("g"),
  packagePrice: numeric("package_price", { precision: 10, scale: 2 }).notNull().default("0"),
  yieldPercent: numeric("yield_percent", { precision: 6, scale: 2 }).notNull().default("100"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 4 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const technicalSheetsTable = pgTable("technical_sheets", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  name: text("name").notNull(),
  totalYield: numeric("total_yield", { precision: 10, scale: 3 }).notNull().default("1"),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 4 }).notNull().default("0"),
  preparationMode: text("preparation_mode"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const technicalSheetItemsTable = pgTable("technical_sheet_items", {
  id: serial("id").primaryKey(),
  technicalSheetId: integer("technical_sheet_id").notNull(),
  ingredientId: integer("ingredient_id").notNull(),
  netQuantity: numeric("net_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  grossQuantity: numeric("gross_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  unit: text("unit").notNull().default("g"),
  ingredientCost: numeric("ingredient_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const generalCostsTable = pgTable("general_costs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("variable"),
  amountType: text("amount_type").notNull().default("percent"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
  applyToDirectSale: boolean("apply_to_direct_sale").notNull().default(true),
  applyToMarketplace: boolean("apply_to_marketplace").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const productExtraCostsTable = pgTable("product_extra_costs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("fixed"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const pricingSimulationsTable = pgTable("pricing_simulations", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  directSalePrice: numeric("direct_sale_price", { precision: 10, scale: 2 }).notNull().default("0"),
  marketplacePrice: numeric("marketplace_price", { precision: 10, scale: 2 }).notNull().default("0"),
  targetCMV: numeric("target_cmv", { precision: 6, scale: 2 }).notNull().default("35"),
  targetMargin: numeric("target_margin", { precision: 6, scale: 2 }).notNull().default("60"),
  monthlySalesEstimate: integer("monthly_sales_estimate").notNull().default(1),
  ingredientCost: numeric("ingredient_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  extraCost: numeric("extra_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  variableCost: numeric("variable_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  fixedCostAllocated: numeric("fixed_cost_allocated", { precision: 10, scale: 2 }).notNull().default("0"),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  cmvPercent: numeric("cmv_percent", { precision: 6, scale: 2 }).notNull().default("0"),
  contributionMargin: numeric("contribution_margin", { precision: 10, scale: 2 }).notNull().default("0"),
  contributionMarginPercent: numeric("contribution_margin_percent", { precision: 6, scale: 2 }).notNull().default("0"),
  netProfit: numeric("net_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  netProfitPercent: numeric("net_profit_percent", { precision: 6, scale: 2 }).notNull().default("0"),
  suggestedDirectPrice: numeric("suggested_direct_price", { precision: 10, scale: 2 }).notNull().default("0"),
  suggestedMarketplacePrice: numeric("suggested_marketplace_price", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGeneralCostSchema = createInsertSchema(generalCostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductExtraCostSchema = createInsertSchema(productExtraCostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPricingSimulationSchema = createInsertSchema(pricingSimulationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIngredientSchema = createInsertSchema(ingredientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTechnicalSheetSchema = createInsertSchema(technicalSheetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTechnicalSheetItemSchema = createInsertSchema(technicalSheetItemsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Ingredient = typeof ingredientsTable.$inferSelect;
export type TechnicalSheet = typeof technicalSheetsTable.$inferSelect;
export type TechnicalSheetItem = typeof technicalSheetItemsTable.$inferSelect;
export type GeneralCost = typeof generalCostsTable.$inferSelect;
export type ProductExtraCost = typeof productExtraCostsTable.$inferSelect;
export type PricingSimulation = typeof pricingSimulationsTable.$inferSelect;
export type InsertGeneralCost = z.infer<typeof insertGeneralCostSchema>;
export type InsertProductExtraCost = z.infer<typeof insertProductExtraCostSchema>;
export type InsertPricingSimulation = z.infer<typeof insertPricingSimulationSchema>;
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type InsertTechnicalSheet = z.infer<typeof insertTechnicalSheetSchema>;
export type InsertTechnicalSheetItem = z.infer<typeof insertTechnicalSheetItemSchema>;
