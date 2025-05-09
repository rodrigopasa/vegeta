import {
  users, type User, type InsertUser,
  contacts, type Contact, type InsertContact,
  messages, type Message, type InsertMessage,
  whatsappInstances, type WhatsappInstance, type InsertWhatsappInstance
} from "@shared/schema";

// Storage interface with CRUD methods
export interface IStorage {
  // User methods (from original)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserCount(): Promise<number>;
  
  // WhatsApp Instance methods
  getWhatsappInstances(): Promise<WhatsappInstance[]>;
  getWhatsappInstance(id: number): Promise<WhatsappInstance | undefined>;
  getWhatsappInstanceByPhone(phoneNumber: string): Promise<WhatsappInstance | undefined>;
  createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance>;
  updateWhatsappInstance(id: number, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined>;
  deleteWhatsappInstance(id: number): Promise<boolean>;
  
  // Contact methods - agora com suporte a múltiplas instâncias
  getContacts(instanceId?: number): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  getContactByPhone(phoneNumber: string, instanceId: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;
  
  // Message methods - agora com suporte a múltiplas instâncias
  getMessages(instanceId?: number): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  getScheduledMessages(instanceId?: number): Promise<Message[]>;
  getPendingMessages(instanceId?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: number, message: Partial<Message>): Promise<Message | undefined>;
  deleteMessage(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private instancesMap: Map<number, WhatsappInstance>;
  private contactsMap: Map<number, Contact>;
  private messagesMap: Map<number, Message>;
  private userCurrentId: number;
  private instanceCurrentId: number;
  private contactCurrentId: number;
  private messageCurrentId: number;

  constructor() {
    this.users = new Map();
    this.instancesMap = new Map();
    this.contactsMap = new Map();
    this.messagesMap = new Map();
    this.userCurrentId = 1;
    this.instanceCurrentId = 1;
    this.contactCurrentId = 1;
    this.messageCurrentId = 1;
  }

  // User methods (from original)
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }
  
  // WhatsApp Instance methods
  async getWhatsappInstances(): Promise<WhatsappInstance[]> {
    return Array.from(this.instancesMap.values());
  }
  
  async getWhatsappInstance(id: number): Promise<WhatsappInstance | undefined> {
    return this.instancesMap.get(id);
  }
  
  async getWhatsappInstanceByPhone(phoneNumber: string): Promise<WhatsappInstance | undefined> {
    return Array.from(this.instancesMap.values()).find(
      (instance) => instance.phoneNumber === phoneNumber,
    );
  }
  
  async createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    const id = this.instanceCurrentId++;
    const now = new Date();
    // Correção para evitar que os campos opcionais sejam passados como undefined
    const newInstance: WhatsappInstance = { 
      id,
      name: instance.name,
      phoneNumber: instance.phoneNumber,
      description: instance.description || null,
      isActive: instance.isActive === undefined ? true : instance.isActive,
      createdAt: now,
      lastConnectedAt: null 
    };
    this.instancesMap.set(id, newInstance);
    return newInstance;
  }
  
  async updateWhatsappInstance(id: number, instanceData: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined> {
    const existingInstance = this.instancesMap.get(id);
    if (!existingInstance) return undefined;
    
    const updatedInstance = { ...existingInstance, ...instanceData };
    this.instancesMap.set(id, updatedInstance);
    return updatedInstance;
  }
  
  async deleteWhatsappInstance(id: number): Promise<boolean> {
    return this.instancesMap.delete(id);
  }

  // Contact methods - updated for multiple instances
  async getContacts(instanceId?: number): Promise<Contact[]> {
    if (instanceId) {
      return Array.from(this.contactsMap.values()).filter(
        contact => contact.instanceId === instanceId
      );
    }
    return Array.from(this.contactsMap.values());
  }

  async getContact(id: number): Promise<Contact | undefined> {
    return this.contactsMap.get(id);
  }

  async getContactByPhone(phoneNumber: string, instanceId: number): Promise<Contact | undefined> {
    return Array.from(this.contactsMap.values()).find(
      (contact) => contact.phoneNumber === phoneNumber && contact.instanceId === instanceId
    );
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = this.contactCurrentId++;
    const contact: Contact = { 
      ...insertContact, 
      id,
      isGroup: insertContact.isGroup ?? false,
      memberCount: insertContact.memberCount ?? null
    };
    this.contactsMap.set(id, contact);
    return contact;
  }

  async updateContact(id: number, contactData: Partial<InsertContact>): Promise<Contact | undefined> {
    const existingContact = this.contactsMap.get(id);
    if (!existingContact) return undefined;
    
    const updatedContact = { ...existingContact, ...contactData };
    this.contactsMap.set(id, updatedContact);
    return updatedContact;
  }

  async deleteContact(id: number): Promise<boolean> {
    return this.contactsMap.delete(id);
  }

  // Message methods - updated for multiple instances
  async getMessages(instanceId?: number): Promise<Message[]> {
    if (instanceId) {
      return Array.from(this.messagesMap.values()).filter(
        message => message.instanceId === instanceId
      );
    }
    return Array.from(this.messagesMap.values());
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return this.messagesMap.get(id);
  }

  async getScheduledMessages(instanceId?: number): Promise<Message[]> {
    let messages = Array.from(this.messagesMap.values())
      .filter(message => message.status === "scheduled");
      
    if (instanceId) {
      messages = messages.filter(message => message.instanceId === instanceId);
    }
    
    return messages;
  }

  async getPendingMessages(instanceId?: number): Promise<Message[]> {
    const now = new Date();
    let messages = Array.from(this.messagesMap.values())
      .filter(message => 
        message.status === "scheduled" && 
        message.scheduledFor && 
        message.scheduledFor <= now
      );
      
    if (instanceId) {
      messages = messages.filter(message => message.instanceId === instanceId);
    }
    
    return messages;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageCurrentId++;
    const message: Message = {
      ...insertMessage,
      id,
      status: "scheduled",
      createdAt: new Date(),
      sentAt: null,
      errorMessage: null,
      isGroup: insertMessage.isGroup ?? false,
      recipientName: insertMessage.recipientName ?? null,
      scheduledFor: insertMessage.scheduledFor ?? null,
      hasMedia: insertMessage.hasMedia ?? false,
      mediaType: insertMessage.mediaType ?? null,
      mediaPath: insertMessage.mediaPath ?? null,
      mediaName: insertMessage.mediaName ?? null,
      mediaCaption: insertMessage.mediaCaption ?? null
    };
    this.messagesMap.set(id, message);
    return message;
  }

  async updateMessage(id: number, messageData: Partial<Message>): Promise<Message | undefined> {
    const existingMessage = this.messagesMap.get(id);
    if (!existingMessage) return undefined;
    
    const updatedMessage = { ...existingMessage, ...messageData };
    this.messagesMap.set(id, updatedMessage);
    return updatedMessage;
  }

  async deleteMessage(id: number): Promise<boolean> {
    return this.messagesMap.delete(id);
  }
}

// Uncomment to use memory storage
// export const storage = new MemStorage();

// Use database storage
import { DatabaseStorage } from "./database-storage";
export const storage = new DatabaseStorage();
