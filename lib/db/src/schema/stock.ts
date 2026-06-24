import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stockItemsTable = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 10, scale: 3 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 4 }).notNull().default("0"),
  supplier: text("supplier"),
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
