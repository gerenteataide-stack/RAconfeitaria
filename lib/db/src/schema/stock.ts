import { boolean, pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stockItemsTable = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ingredientType: text("ingredient_type").notNull().default("comprado"),
  unit: text("unit").notNull(),
  packageContent: numeric("package_content", { precision: 10, scale: 3 }).notNull().default("1"),
  packagePrice: numeric("package_price", { precision: 10, scale: 2 }).notNull().default("0"),
  yieldPercent: numeric("yield_percent", { precision: 6, scale: 2 }).notNull().default("100"),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 10, scale: 3 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 4 }).notNull().default("0"),
  supplier: text("supplier"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  stockItemId: serial("stock_item_id").notNull(),
  type: text("type").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStockItemSchema = createInsertSchema(stockItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;
export type StockItem = typeof stockItemsTable.$inferSelect;
