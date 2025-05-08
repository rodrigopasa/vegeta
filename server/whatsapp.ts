// Importar WhatsApp Web.js como CommonJS
import { Client } from "whatsapp-web.js";
// Tipos para TypeScript
type WhatsAppClient = any;
import { storage } from "./storage";
import { InsertContact, InsertMessage } from "@shared/schema";
import { WebSocketServer } from "ws";
import { Server } from "http";
import { log } from "./vite";
import WebSocket from "ws";

interface WhatsAppManager {
  client: WhatsAppClient | null;
  isInitialized: boolean;
  isConnected: boolean;
  qrCode: string | null;
  initializeClient(): Promise<void>;
  getQRCode(): string | null;
  sendMessage(to: string, content: string): Promise<string>;
  refreshContacts(): Promise<void>;
}

class WhatsAppService implements WhatsAppManager {
  client: WhatsAppClient | null = null;
  isInitialized: boolean = false;
  isConnected: boolean = false;
  qrCode: string | null = null;
  wss: WebSocketServer | null = null;
  messageScheduler: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeClient();
    this.startMessageScheduler();
  }

  setupWebSockets(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    log('WebSocket server initialized', 'whatsapp');
    
    this.wss.on('connection', (ws) => {
      log('WebSocket client connected', 'whatsapp');
      
      // Send initial state
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'CONNECTION_STATE',
          payload: {
            isConnected: this.isConnected,
            isInitialized: this.isInitialized,
            qrCode: this.qrCode
          }
        }));
      }
    });
  }

  broadcastToClients(data: any) {
    if (!this.wss) return;
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  async initializeClient(): Promise<void> {
    try {
      if (this.client) {
        this.client.destroy();
        this.client = null;
      }

      log('Initializing WhatsApp client', 'whatsapp');
      this.client = new Client({
        puppeteer: {
          headless: true,
          executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process']
        }
      });

      // Register event handlers
      this.client.on('qr', (qr: string) => {
        log('QR Code received', 'whatsapp');
        this.qrCode = qr;
        this.broadcastToClients({
          type: 'QR_CODE',
          payload: qr
        });
      });

      this.client.on('authenticated', () => {
        log('WhatsApp authenticated', 'whatsapp');
        this.qrCode = null;
        this.broadcastToClients({
          type: 'AUTHENTICATED',
          payload: { authenticated: true }
        });
      });
      
      // Eventos de atualização de status de mensagem
      this.client.on('message_ack', async (message: any) => {
        try {
          log(`Message ACK received: ${message.id._serialized} - Status: ${message.ack}`, 'whatsapp');
          
          // Mapear os códigos de status do WhatsApp para nossos status
          // 0: pendente, 1: enviado para o servidor, 2: recebido no dispositivo, 3: lido
          let status = 'pending';
          switch (message.ack) {
            case 1:
              status = 'sent';
              break;
            case 2:
              status = 'delivered';
              break;
            case 3:
              status = 'read';
              break;
          }
          
          // Buscar mensagens no nosso banco para atualizar pelo ID do WhatsApp
          // Este é um método simplificado, pode precisar ser adaptado
          const messages = await storage.getMessages();
          for (const dbMessage of messages) {
            if (dbMessage.status === 'sent' || dbMessage.status === 'delivered') {
              await storage.updateMessage(dbMessage.id, { status });
            }
          }
          
          this.broadcastToClients({
            type: 'MESSAGE_STATUS_UPDATE',
            payload: { 
              messageId: message.id._serialized,
              status
            }
          });
        } catch (error) {
          log(`Error processing message ACK: ${error}`, 'whatsapp');
        }
      });

      this.client.on('auth_failure', (msg: string) => {
        log(`Authentication failure: ${msg}`, 'whatsapp');
        this.isConnected = false;
        this.broadcastToClients({
          type: 'AUTH_FAILURE',
          payload: { message: msg }
        });
      });

      this.client.on('ready', async () => {
        log('WhatsApp client is ready', 'whatsapp');
        this.isConnected = true;
        this.isInitialized = true;
        this.qrCode = null;
        
        this.broadcastToClients({
          type: 'READY',
          payload: { isConnected: true }
        });
        
        // Sync contacts when client is ready
        await this.refreshContacts();
      });

      this.client.on('disconnected', (reason: string) => {
        log(`WhatsApp client disconnected: ${reason}`, 'whatsapp');
        this.isConnected = false;
        this.broadcastToClients({
          type: 'DISCONNECTED',
          payload: { reason }
        });
      });

      await this.client.initialize();
      this.isInitialized = true;
    } catch (error) {
      log(`Error initializing WhatsApp client: ${error}`, 'whatsapp');
      this.isInitialized = false;
      this.isConnected = false;
      this.broadcastToClients({
        type: 'INIT_ERROR',
        payload: { error: (error as Error).message }
      });
    }
  }

  getQRCode(): string | null {
    return this.qrCode;
  }

  // Funções para processar variáveis na mensagem
  private processMessageVariables(content: string, recipientName: string | null): string {
    if (!content) return content;
    
    const now = new Date();
    // Formato para data em Português Brasil (SP)
    const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo'
    });
    
    // Formato para hora em Português Brasil (SP)
    const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
    
    // Substituir variáveis
    const processed = content
      .replace(/\{\{nome\}\}/g, recipientName || 'Cliente')
      .replace(/\{\{data\}\}/g, dateFormatter.format(now))
      .replace(/\{\{hora\}\}/g, timeFormatter.format(now));
      
    return processed;
  }
  
  // Funções para processar menções na mensagem
  private async processMessageMentions(content: string): Promise<string> {
    if (!content) return content;
    
    // Processa menções de contatos (@Nome)
    return content.replace(/@([^\s]+)/g, (match, name) => {
      // No WhatsApp Web podemos substituir com a menção real, 
      // mas por enquanto manteremos o texto original
      return match;
    });
  }

  async sendMessage(to: string, content: string, recipientName: string | null = null): Promise<string> {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('WhatsApp client is not connected');
      }

      // Format phone number if needed
      const formattedNumber = to.includes('@g.us') ? to : to.replace(/\D/g, '');
      const chatId = to.includes('@g.us') ? to : `${formattedNumber}@c.us`;
      
      // Processar variáveis e menções na mensagem
      let processedContent = this.processMessageVariables(content, recipientName);
      processedContent = await this.processMessageMentions(processedContent);
      
      const response = await this.client.sendMessage(chatId, processedContent);
      return response.id._serialized;
    } catch (error) {
      log(`Error sending message: ${error}`, 'whatsapp');
      throw error;
    }
  }

  async refreshContacts(): Promise<void> {
    try {
      if (!this.client || !this.isConnected) {
        return;
      }

      log('Refreshing contacts', 'whatsapp');
      const contacts = await this.client.getContacts();
      const chats = await this.client.getChats();
      
      // Process contacts
      for (const contact of contacts) {
        if (contact.isMyContact && contact.name) {
          const existingContact = await storage.getContactByPhone(contact.id._serialized);
          
          if (!existingContact) {
            const newContact: InsertContact = {
              name: contact.name,
              phoneNumber: contact.id._serialized,
              isGroup: false,
              memberCount: null
            };
            await storage.createContact(newContact);
          }
        }
      }
      
      // Process groups
      for (const chat of chats) {
        if (chat.isGroup) {
          const existingGroup = await storage.getContactByPhone(chat.id._serialized);
          
          if (!existingGroup) {
            const participants = await chat.participants || [];
            const newGroup: InsertContact = {
              name: chat.name,
              phoneNumber: chat.id._serialized,
              isGroup: true,
              memberCount: participants.length
            };
            await storage.createContact(newGroup);
          }
        }
      }
      
      log('Contacts refreshed successfully', 'whatsapp');
      this.broadcastToClients({
        type: 'CONTACTS_REFRESHED',
        payload: { success: true }
      });
    } catch (error) {
      log(`Error refreshing contacts: ${error}`, 'whatsapp');
      this.broadcastToClients({
        type: 'CONTACTS_REFRESH_ERROR',
        payload: { error: (error as Error).message }
      });
    }
  }

  // Método público para enviar notificações de status a partir de fora da classe
  async sendStatusNotification(
    success: boolean, 
    messageInfo: { 
      id: number, 
      recipient: string, 
      recipientName?: string | null,
      content: string,
      isGroup?: boolean | null
    },
    errorMessage?: string
  ): Promise<void> {
    return this._sendStatusNotification(success, messageInfo, errorMessage);
  }

  // Função interna para enviar notificação de status para o administrador
  private async _sendStatusNotification(
    success: boolean, 
    messageInfo: { 
      id: number, 
      recipient: string, 
      recipientName?: string | null,
      content: string,
      isGroup?: boolean | null
    },
    errorMessage?: string
  ) {
    try {
      const adminPhone = "554197251311"; // Número do administrador para receber notificações
      const recipientDisplay = messageInfo.recipientName || messageInfo.recipient;
      const groupStatus = messageInfo.isGroup ? " (grupo)" : "";
      
      let statusMessage = "";
      if (success) {
        statusMessage = `✅ Mensagem #${messageInfo.id} enviada com sucesso para ${recipientDisplay}${groupStatus}.\n\nConteúdo: "${this.truncateMessage(messageInfo.content, 100)}"`;
      } else {
        statusMessage = `❌ Falha ao enviar mensagem #${messageInfo.id} para ${recipientDisplay}${groupStatus}.\n\nErro: ${errorMessage}\n\nConteúdo: "${this.truncateMessage(messageInfo.content, 100)}"`;
      }
      
      // Envia a notificação para o administrador
      log(`Sending status notification to admin: ${adminPhone}`, 'whatsapp');
      await this.sendMessage(adminPhone, statusMessage);
      log('Status notification sent successfully', 'whatsapp');
    } catch (error) {
      log(`Failed to send status notification: ${error}`, 'whatsapp');
      // Não propagamos o erro para não interromper o fluxo principal
    }
  }
  
  // Função auxiliar para truncar mensagens longas
  private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }
  
  startMessageScheduler() {
    // Check for pending messages every minute
    this.messageScheduler = setInterval(async () => {
      try {
        if (!this.isConnected) return;
        
        const pendingMessages = await storage.getPendingMessages();
        log(`Processing ${pendingMessages.length} pending messages`, 'whatsapp');
        
        for (const message of pendingMessages) {
          try {
            // Update message status to sending
            await storage.updateMessage(message.id, { status: 'sending' });
            
            // Send the message
            const messageId = await this.sendMessage(message.recipient, message.content, message.recipientName);
            
            // Update message as sent
            await storage.updateMessage(message.id, {
              status: 'sent',
              sentAt: new Date()
            });
            
            log(`Message ${message.id} sent successfully`, 'whatsapp');
            this.broadcastToClients({
              type: 'MESSAGE_SENT',
              payload: { messageId: message.id, success: true }
            });
            
            // Enviar notificação de sucesso para o administrador
            await this._sendStatusNotification(true, message);
            
          } catch (error) {
            log(`Error sending scheduled message ${message.id}: ${error}`, 'whatsapp');
            
            // Update message as failed
            await storage.updateMessage(message.id, {
              status: 'failed',
              errorMessage: (error as Error).message
            });
            
            this.broadcastToClients({
              type: 'MESSAGE_SEND_ERROR',
              payload: { 
                messageId: message.id, 
                error: (error as Error).message 
              }
            });
            
            // Enviar notificação de falha para o administrador
            await this._sendStatusNotification(false, message, (error as Error).message);
          }
        }
      } catch (error) {
        log(`Error in message scheduler: ${error}`, 'whatsapp');
      }
    }, 60000); // Run every minute
  }

  stopMessageScheduler() {
    if (this.messageScheduler) {
      clearInterval(this.messageScheduler);
      this.messageScheduler = null;
    }
  }
}

export const whatsAppService = new WhatsAppService();
