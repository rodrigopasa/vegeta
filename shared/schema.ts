import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema (preserved from original)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// WhatsApp instances schema - nova tabela para gerenciar múltiplos números
export const whatsappInstances = pgTable("whatsapp_instances", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastConnectedAt: timestamp("last_connected_at"),
});

export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances).pick({
  name: true,
  phoneNumber: true,
  description: true,
  isActive: true,
});

// WhatsApp contacts schema - modificado para incluir a instância
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  isGroup: boolean("is_group").default(false),
  memberCount: integer("member_count"),
  instanceId: integer("instance_id").notNull(), // Referência à instância do WhatsApp
}, (table) => {
  return {
    // Índice composto para garantir unicidade por instância
    contactInstanceIdx: uniqueIndex("contact_instance_idx").on(table.phoneNumber, table.instanceId),
  };
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  name: true,
  phoneNumber: true,
  isGroup: true,
  memberCount: true,
  instanceId: true,
});

// Message schema - modificado para incluir a instância
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  recipient: text("recipient").notNull(),
  recipientName: text("recipient_name"),
  isGroup: boolean("is_group").default(false),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  status: text("status").notNull().default("scheduled"), // scheduled, sent, delivered, read, failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  // File/Media related fields
  hasMedia: boolean("has_media").default(false),
  mediaType: text("media_type"), // image, document, video, audio
  mediaPath: text("media_path"),
  mediaName: text("media_name"),
  mediaCaption: text("media_caption"),
  // Referência à instância do WhatsApp
  instanceId: integer("instance_id").notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  sentAt: true,
  status: true,
  errorMessage: true,
  createdAt: true,
});

// Exports for types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertWhatsappInstance = z.infer<typeof insertWhatsappInstanceSchema>;
export type WhatsappInstance = typeof whatsappInstances.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Extended message schema with validation
export const messageWithValidationSchema = insertMessageSchema.extend({
  content: z.string().min(1, "Message content is required"),
  recipient: z.string().min(1, "Recipient is required"),
  instanceId: z.number().int().positive("Instance ID is required"),
  scheduledFor: z.date().optional(),
  hasMedia: z.boolean().optional(),
  mediaType: z.string().optional(),
  mediaPath: z.string().optional(),
  mediaName: z.string().optional(),
  mediaCaption: z.string().optional(),
});

export type MessageWithValidation = z.infer<typeof messageWithValidationSchema>;
