import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
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
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  name: true,
  phoneNumber: true,
  isGroup: true,
  memberCount: true,
  email: true,
  notes: true,
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
  // File/Media related fields
  hasMedia: boolean("has_media").default(false),
  mediaType: text("media_type"), // image, document, video, audio
  mediaPath: text("media_path"),
  mediaName: text("media_name"),
  mediaCaption: text("media_caption"),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  sentAt: true,
  status: true,
  errorMessage: true,
  createdAt: true,
});

// Chatbot sessions schema
export const chatbotSessions = pgTable("chatbot_sessions", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id),
  sessionId: text("session_id").notNull(),
  lastMessage: timestamp("last_message").defaultNow(),
  conversationHistory: jsonb("conversation_history").default('[]'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatbotSessionSchema = createInsertSchema(chatbotSessions).omit({
  id: true,
  lastMessage: true,
  createdAt: true,
});

// Appointments schema
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  googleEventId: text("google_event_id"),
  status: text("status").default("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Exports for types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertChatbotSession = z.infer<typeof insertChatbotSessionSchema>;
export type ChatbotSession = typeof chatbotSessions.$inferSelect;

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

// Extended message schema with validation
export const messageWithValidationSchema = insertMessageSchema.extend({
  content: z.string().min(1, "Message content is required"),
  recipient: z.string().min(1, "Recipient is required"),
  scheduledFor: z.date().optional(),
  hasMedia: z.boolean().optional(),
  mediaType: z.string().optional(),
  mediaPath: z.string().optional(),
  mediaName: z.string().optional(),
  mediaCaption: z.string().optional(),
});

export type MessageWithValidation = z.infer<typeof messageWithValidationSchema>;
