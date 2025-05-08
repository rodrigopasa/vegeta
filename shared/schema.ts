import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
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

// WhatsApp contacts schema
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull().unique(),
  isGroup: boolean("is_group").default(false),
  memberCount: integer("member_count"),
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  name: true,
  phoneNumber: true,
  isGroup: true,
  memberCount: true,
});

// Message schema
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

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Extended message schema with validation
export const messageWithValidationSchema = insertMessageSchema.extend({
  content: z.string().min(1, "Message content is required"),
  recipient: z.string().min(1, "Recipient is required"),
  scheduledFor: z.date().optional(),
});

export type MessageWithValidation = z.infer<typeof messageWithValidationSchema>;
