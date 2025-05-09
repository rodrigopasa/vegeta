import {
  users, contacts, messages, whatsappInstances,
  type User, type InsertUser,
  type Contact, type InsertContact,
  type Message, type InsertMessage,
  type WhatsappInstance, type InsertWhatsappInstance,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, lte, isNull } from "drizzle-orm";
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

  // WhatsApp Instance methods
  async getWhatsappInstances(): Promise<WhatsappInstance[]> {
    return db.select().from(whatsappInstances);
  }

  async getWhatsappInstance(id: number): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.id, id));
    return instance || undefined;
  }

  async getWhatsappInstanceByPhone(phoneNumber: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.phoneNumber, phoneNumber));
    return instance || undefined;
  }

  async createWhatsappInstance(insertInstance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    const [instance] = await db
      .insert(whatsappInstances)
      .values({
        ...insertInstance,
        createdAt: new Date()
      })
      .returning();
    return instance;
  }

  async updateWhatsappInstance(id: number, instanceData: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined> {
    const [instance] = await db
      .update(whatsappInstances)
      .set(instanceData)
      .where(eq(whatsappInstances.id, id))
      .returning();
    return instance || undefined;
  }

  async deleteWhatsappInstance(id: number): Promise<boolean> {
    const result = await db
      .delete(whatsappInstances)
      .where(eq(whatsappInstances.id, id))
      .returning({ id: whatsappInstances.id });
    return result.length > 0;
  }

  async getContacts(instanceId?: number): Promise<Contact[]> {
    if (instanceId) {
      return db.select().from(contacts).where(eq(contacts.instanceId, instanceId));
    }
    return db.select().from(contacts);
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async getContactByPhone(phoneNumber: string, instanceId: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(
      and(
        eq(contacts.phoneNumber, phoneNumber),
        eq(contacts.instanceId, instanceId)
      )
    );
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

  async getMessages(instanceId?: number): Promise<Message[]> {
    if (instanceId) {
      return db.select().from(messages).where(eq(messages.instanceId, instanceId));
    }
    return db.select().from(messages);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async getScheduledMessages(instanceId?: number): Promise<Message[]> {
    if (instanceId) {
      return db
        .select()
        .from(messages)
        .where(and(
          eq(messages.status, 'scheduled'),
          eq(messages.instanceId, instanceId)
        ));
    }
    
    return db
      .select()
      .from(messages)
      .where(eq(messages.status, 'scheduled'));
  }

  async getPendingMessages(instanceId?: number): Promise<Message[]> {
    const now = new Date();
    
    if (instanceId) {
      return db
        .select()
        .from(messages)
        .where(and(
          eq(messages.status, 'scheduled'),
          lte(messages.scheduledFor, now),
          eq(messages.instanceId, instanceId)
        ));
    }
    
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
}