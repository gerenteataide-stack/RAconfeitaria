import { boolean, date, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deliveryZonesTable = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cepStart: text("cep_start"),
  cepEnd: text("cep_end"),
  neighborhood: text("neighborhood"),
  fee: numeric("fee", { precision: 10, scale: 2 }).notNull().default("0"),
  minOrder: numeric("min_order", { precision: 10, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  type: text("type").notNull().default("percent"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
  minOrder: numeric("min_order", { precision: 10, scale: 2 }).notNull().default("0"),
  startsAt: date("starts_at", { mode: "string" }),
  endsAt: date("ends_at", { mode: "string" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  audience: text("audience").notNull().default("admin"),
  channel: text("channel").notNull().default("system"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull().default("system"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  metadata: text("metadata"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeliveryZoneSchema = createInsertSchema(deliveryZonesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCouponSchema = createInsertSchema(couponsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settingsTable).omit({ updatedAt: true });

export type InsertDeliveryZone = z.infer<typeof insertDeliveryZoneSchema>;
export type DeliveryZone = typeof deliveryZonesTable.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof couponsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
