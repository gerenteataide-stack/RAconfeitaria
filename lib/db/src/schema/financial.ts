import { pgTable, serial, text, timestamp, integer, numeric, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financialEntriesTable = pgTable("financial_entries", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  paidAt: date("paid_at", { mode: "string" }),
  paid: boolean("paid").notNull().default(false),
  counterpart: text("counterpart"),
  category: text("category"),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFinancialEntrySchema = createInsertSchema(financialEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialEntry = z.infer<typeof insertFinancialEntrySchema>;
export type FinancialEntry = typeof financialEntriesTable.$inferSelect;
