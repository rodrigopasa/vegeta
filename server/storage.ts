import {
  users, type User, type InsertUser,
  contacts, type Contact, type InsertContact,
  messages, type Message, type InsertMessage,
} from "@shared/schema";

// Storage interface with CRUD methods
export interface IStorage {
  // User methods (from original)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserCount(): Promise<number>;
  
  // Contact methods
  getContacts(): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  getContactByPhone(phoneNumber: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;
  
  // Message methods
  getMessages(): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  getScheduledMessages(): Promise<Message[]>;
  getPendingMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: number, message: Partial<Message>): Promise<Message | undefined>;
  deleteMessage(id: number): Promise<boolean>;
  
  // Chatbot session methods
  getChatbotSessions(): Promise<ChatbotSession[]>;
  getChatbotSession(id: number): Promise<ChatbotSession | undefined>;
  getChatbotSessionBySessionId(sessionId: string): Promise<ChatbotSession | undefined>;
  getChatbotSessionsByContactId(contactId: number): Promise<ChatbotSession[]>;
  createChatbotSession(session: InsertChatbotSession): Promise<ChatbotSession>;
  updateChatbotSession(id: number, session: Partial<ChatbotSession>): Promise<ChatbotSession | undefined>;
  deleteChatbotSession(id: number): Promise<boolean>;
  
  // Appointment methods
  getAppointments(): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  getAppointmentsByContactId(contactId: number): Promise<Appointment[]>;
  getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<Appointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contactsMap: Map<number, Contact>;
  private messagesMap: Map<number, Message>;
  private userCurrentId: number;
  private contactCurrentId: number;
  private messageCurrentId: number;

  constructor() {
    this.users = new Map();
    this.contactsMap = new Map();
    this.messagesMap = new Map();
    this.userCurrentId = 1;
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

  // Contact methods
  async getContacts(): Promise<Contact[]> {
    return Array.from(this.contactsMap.values());
  }

  async getContact(id: number): Promise<Contact | undefined> {
    return this.contactsMap.get(id);
  }

  async getContactByPhone(phoneNumber: string): Promise<Contact | undefined> {
    return Array.from(this.contactsMap.values()).find(
      (contact) => contact.phoneNumber === phoneNumber,
    );
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = this.contactCurrentId++;
    const contact: Contact = { ...insertContact, id };
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

  // Message methods
  async getMessages(): Promise<Message[]> {
    return Array.from(this.messagesMap.values());
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return this.messagesMap.get(id);
  }

  async getScheduledMessages(): Promise<Message[]> {
    return Array.from(this.messagesMap.values())
      .filter(message => message.status === "scheduled");
  }

  async getPendingMessages(): Promise<Message[]> {
    const now = new Date();
    return Array.from(this.messagesMap.values())
      .filter(message => 
        message.status === "scheduled" && 
        message.scheduledFor && 
        message.scheduledFor <= now
      );
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageCurrentId++;
    const message: Message = {
      ...insertMessage,
      id,
      status: "scheduled",
      createdAt: new Date(),
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
