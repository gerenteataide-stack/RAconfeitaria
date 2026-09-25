import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export const customerOrderPushTokensTable = pgTable("customer_order_push_tokens", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  orderTokenUnique: uniqueIndex("customer_order_push_tokens_order_token_hash_unique").on(table.orderId, table.tokenHash),
  orderIndex: index("customer_order_push_tokens_order_id_idx").on(table.orderId),
}));
