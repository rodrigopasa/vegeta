// Importar WhatsApp Web.js como CommonJS
import { Client } from "whatsapp-web.js";
// Para o MessageMedia, precisamos usar o import padrão
import WhatsAppWebJS from "whatsapp-web.js";
const { MessageMedia } = WhatsAppWebJS;
// Tipos para TypeScript
type WhatsAppClient = any;
import { storage as dbStorage } from "./storage";
import { InsertContact, InsertMessage, WhatsappInstance } from "@shared/schema";
import { WebSocketServer } from "ws";
import { Server } from "http";
import { log } from "./vite";
import WebSocket from "ws";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

interface WhatsAppInstanceData {
  id: number;
  client: WhatsAppClient | null;
  isInitialized: boolean;
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber: string;
  name: string;
}

interface WhatsAppManager {
  initializeClient(instanceId: number): Promise<void>;
  getQRCode(instanceId: number): string | null;
  sendMessage(instanceId: number, to: string, content: string, recipientName?: string | null, mediaPath?: string | null, mediaType?: string | null, mediaCaption?: string | null): Promise<string>;
  refreshContacts(instanceId: number): Promise<void>;
  getInstances(): Promise<WhatsappInstance[]>;
  getInstance(instanceId: number): Promise<WhatsAppInstanceData | null>;
  createInstance(name: string, phoneNumber: string, description?: string): Promise<WhatsappInstance>;
}

class WhatsAppService implements WhatsAppManager {
  private instances: Map<number, WhatsAppInstanceData> = new Map();
  wss: WebSocketServer | null = null;
  messageScheduler: NodeJS.Timeout | null = null;

  constructor() {
    this.loadInstances();
    this.startMessageScheduler();
  }
  
  private async loadInstances(): Promise<void> {
    try {
      // Carregar todas as instâncias do banco de dados
      const instances = await dbStorage.getWhatsappInstances();
      
      // Inicializar cada instância
      for (const instance of instances) {
        if (instance.isActive) {
          this.instances.set(instance.id, {
            id: instance.id,
            client: null,
            isInitialized: false,
            isConnected: false,
            qrCode: null,
            phoneNumber: instance.phoneNumber,
            name: instance.name
          });
          
          // Inicializar cliente para esta instância
          await this.initializeClient(instance.id);
        }
      }
      
      log(`Loaded ${this.instances.size} WhatsApp instances`, 'whatsapp');
    } catch (error) {
      log(`Error loading WhatsApp instances: ${error}`, 'whatsapp');
    }
  }

  setupWebSockets(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    log('WebSocket server initialized', 'whatsapp');
    
    this.wss.on('connection', (ws) => {
      log('WebSocket client connected', 'whatsapp');
      
      // Send initial state for all instances
      if (ws.readyState === WebSocket.OPEN) {
        // Enviar lista de instâncias disponíveis
        this.getInstancesStatus().then(instancesStatus => {
          ws.send(JSON.stringify({
            type: 'INSTANCES_STATUS',
            payload: instancesStatus
          }));
        });
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
  
  // Método para obter status de todas as instâncias
  private async getInstancesStatus(): Promise<any[]> {
    const status = [];
    
    for (const [id, instance] of this.instances.entries()) {
      status.push({
        id,
        name: instance.name,
        phoneNumber: instance.phoneNumber,
        isConnected: instance.isConnected,
        isInitialized: instance.isInitialized,
        qrCode: instance.qrCode
      });
    }
    
    return status;
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
          const messages = await dbStorage.getMessages();
          for (const dbMessage of messages) {
            if (dbMessage.status === 'sent' || dbMessage.status === 'delivered') {
              await dbStorage.updateMessage(dbMessage.id, { status });
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

  async sendMessage(
    to: string, 
    content: string, 
    recipientName: string | null = null, 
    mediaPath: string | null = null, 
    mediaType: string | null = null, 
    mediaCaption: string | null = null
  ): Promise<string> {
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

      // Se tiver um caminho de mídia, enviar como anexo
      if (mediaPath && fs.existsSync(mediaPath)) {
        log(`Sending media message from path: ${mediaPath}`, 'whatsapp');
        
        // Obter o tipo MIME do arquivo
        const mimeType = mime.lookup(mediaPath) || 'application/octet-stream';
        
        // Ler o arquivo como Base64
        const fileData = fs.readFileSync(mediaPath, {encoding: 'base64'});
        
        // Nome do arquivo
        const fileName = path.basename(mediaPath);
        
        // Criar objeto MessageMedia
        const media = new MessageMedia(mimeType, fileData, fileName);
        
        // Usar a legenda se fornecida, senão usar o conteúdo da mensagem
        const caption = mediaCaption || processedContent;
        
        // Enviar mensagem com mídia
        const response = await this.client.sendMessage(chatId, media, { caption });
        
        log(`Media message sent successfully with ID: ${response.id._serialized}`, 'whatsapp');
        return response.id._serialized;
      }
      else {
        // Enviar mensagem de texto normal
        const response = await this.client.sendMessage(chatId, processedContent);
        return response.id._serialized;
      }
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
          const existingContact = await dbStorage.getContactByPhone(contact.id._serialized);
          
          if (!existingContact) {
            const newContact: InsertContact = {
              name: contact.name,
              phoneNumber: contact.id._serialized,
              isGroup: false,
              memberCount: null
            };
            await dbStorage.createContact(newContact);
          }
        }
      }
      
      // Process groups
      for (const chat of chats) {
        if (chat.isGroup) {
          const existingGroup = await dbStorage.getContactByPhone(chat.id._serialized);
          
          if (!existingGroup) {
            const participants = await chat.participants || [];
            const newGroup: InsertContact = {
              name: chat.name,
              phoneNumber: chat.id._serialized,
              isGroup: true,
              memberCount: participants.length
            };
            await dbStorage.createContact(newGroup);
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
        
        const pendingMessages = await dbStorage.getPendingMessages();
        log(`Processing ${pendingMessages.length} pending messages`, 'whatsapp');
        
        for (const message of pendingMessages) {
          try {
            // Update message status to sending
            await dbStorage.updateMessage(message.id, { status: 'sending' });
            
            // Send the message
            const messageId = await this.sendMessage(
              message.recipient, 
              message.content, 
              message.recipientName,
              message.mediaPath || null,
              message.mediaType || null,
              message.mediaCaption || null
            );
            
            // Update message as sent
            await dbStorage.updateMessage(message.id, {
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
            await dbStorage.updateMessage(message.id, {
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
