import {
  users, contacts, messages, chatbotSessions, appointments,
  type User, type InsertUser,
  type Contact, type InsertContact,
  type Message, type InsertMessage,
  type ChatbotSession, type InsertChatbotSession,
  type Appointment, type InsertAppointment,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, lte, isNull, gte, between } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUserCount(): Promise<number> {
    const result = await db.select().from(users);
    return result.length || 0;
  }

  async getContacts(): Promise<Contact[]> {
    return db.select().from(contacts);
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async getContactByPhone(phoneNumber: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.phoneNumber, phoneNumber));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async updateContact(id: number, contactData: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db
      .update(contacts)
      .set(contactData)
      .where(eq(contacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<boolean> {
    const result = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    return result.length > 0;
  }

  async getMessages(): Promise<Message[]> {
    return db.select().from(messages);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async getScheduledMessages(): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.status, 'scheduled'));
  }

  async getPendingMessages(): Promise<Message[]> {
    const now = new Date();
    return db
      .select()
      .from(messages)
      .where(and(
        eq(messages.status, 'scheduled'),
        lte(messages.scheduledFor, now)
      ));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values({
        ...insertMessage,
        status: "scheduled",
        createdAt: new Date()
      })
      .returning();
    return message;
  }

  async updateMessage(id: number, messageData: Partial<Message>): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set(messageData)
      .where(eq(messages.id, id))
      .returning();
    return message || undefined;
  }

  async deleteMessage(id: number): Promise<boolean> {
    const result = await db
      .delete(messages)
      .where(eq(messages.id, id))
      .returning({ id: messages.id });
    return result.length > 0;
  }

  // Chatbot session methods
  async getChatbotSessions(): Promise<ChatbotSession[]> {
    return db.select().from(chatbotSessions);
  }

  async getChatbotSession(id: number): Promise<ChatbotSession | undefined> {
    const [session] = await db.select().from(chatbotSessions).where(eq(chatbotSessions.id, id));
    return session || undefined;
  }

  async getChatbotSessionBySessionId(sessionId: string): Promise<ChatbotSession | undefined> {
    const [session] = await db.select().from(chatbotSessions).where(eq(chatbotSessions.sessionId, sessionId));
    return session || undefined;
  }

  async getChatbotSessionsByContactId(contactId: number): Promise<ChatbotSession[]> {
    return db.select().from(chatbotSessions).where(eq(chatbotSessions.contactId, contactId));
  }

  async createChatbotSession(insertSession: InsertChatbotSession): Promise<ChatbotSession> {
    const [session] = await db
      .insert(chatbotSessions)
      .values({
        ...insertSession,
        lastMessage: new Date(),
        createdAt: new Date()
      })
      .returning();
    return session;
  }

  async updateChatbotSession(id: number, sessionData: Partial<ChatbotSession>): Promise<ChatbotSession | undefined> {
    const [session] = await db
      .update(chatbotSessions)
      .set(sessionData)
      .where(eq(chatbotSessions.id, id))
      .returning();
    return session || undefined;
  }

  async deleteChatbotSession(id: number): Promise<boolean> {
    const result = await db
      .delete(chatbotSessions)
      .where(eq(chatbotSessions.id, id))
      .returning({ id: chatbotSessions.id });
    return result.length > 0;
  }

  // Appointment methods
  async getAppointments(): Promise<Appointment[]> {
    return db.select().from(appointments);
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment || undefined;
  }

  async getAppointmentsByContactId(contactId: number): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.contactId, contactId));
  }

  async getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    return db
      .select()
      .from(appointments)
      .where(
        and(
          gte(appointments.startTime, startDate),
          lte(appointments.endTime, endDate)
        )
      );
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const now = new Date();
    const [appointment] = await db
      .insert(appointments)
      .values({
        ...insertAppointment,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return appointment;
  }

  async updateAppointment(id: number, appointmentData: Partial<Appointment>): Promise<Appointment | undefined> {
    const [appointment] = await db
      .update(appointments)
      .set({
        ...appointmentData,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, id))
      .returning();
    return appointment || undefined;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await db
      .delete(appointments)
      .where(eq(appointments.id, id))
      .returning({ id: appointments.id });
    return result.length > 0;
  }
}