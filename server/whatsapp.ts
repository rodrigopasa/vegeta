// Importar WhatsApp Web.js como CommonJS
import { Client } from "whatsapp-web.js";
// Para o MessageMedia, precisamos usar o import padrão
import WhatsAppWebJS from "whatsapp-web.js";
const { MessageMedia } = WhatsAppWebJS;
// Tipos para TypeScript
type WhatsAppClient = any;
import { storage as dbStorage } from "./storage";
import { InsertContact, InsertMessage } from "@shared/schema";
import { WebSocketServer } from "ws";
import { Server } from "http";
import { log } from "./vite";
import WebSocket from "ws";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

interface WhatsAppManager {
  client: WhatsAppClient | null;
  isInitialized: boolean;
  isConnected: boolean;
  qrCode: string | null;
  initializeClient(): Promise<void>;
  getQRCode(): string | null;
  sendMessage(to: string, content: string, recipientName?: string | null, mediaPath?: string | null, mediaType?: string | null, mediaCaption?: string | null): Promise<string>;
  refreshContacts(): Promise<void>;
  setRateLimit(options: { messagesPerBatch?: number; delayBetweenMessages?: number; delayBetweenBatches?: number; isEnabled?: boolean; }): any;
  getRateLimitSettings(): { messagesPerBatch: number; delayBetweenMessages: number; delayBetweenBatches: number; isEnabled: boolean; };
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

  // Controle de taxa para evitar bloqueios
  private messageQueue: Array<{
    to: string;
    content: string;
    recipientName?: string | null;
    mediaPath?: string | null;
    mediaType?: string | null;
    mediaCaption?: string | null;
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
  }> = [];
  private isProcessingQueue: boolean = false;
  
  // Configurações de rate limiting
  private messagingRateLimit = {
    messagesPerBatch: 10,       // Número de mensagens por lote
    delayBetweenMessages: 3000, // Delay entre mensagens em ms (3s)
    delayBetweenBatches: 30000, // Delay entre lotes em ms (30s)
    isEnabled: true             // Ativar/desativar rate limiting
  };
  
  // Método para configurar o rate limiting
  setRateLimit(options: {
    messagesPerBatch?: number;
    delayBetweenMessages?: number;
    delayBetweenBatches?: number;
    isEnabled?: boolean;
  }) {
    // Validar limites mínimos para prevenir bloqueios
    if (options.messagesPerBatch !== undefined && options.messagesPerBatch < 1) {
      options.messagesPerBatch = 1;
    }
    
    if (options.delayBetweenMessages !== undefined && options.delayBetweenMessages < 1000) {
      options.delayBetweenMessages = 1000; // Mínimo de 1 segundo entre mensagens
    }
    
    if (options.delayBetweenBatches !== undefined && options.delayBetweenBatches < 5000) {
      options.delayBetweenBatches = 5000; // Mínimo de 5 segundos entre lotes
    }
    
    Object.assign(this.messagingRateLimit, options);
    log(`Rate limiting configurado: ${JSON.stringify(this.messagingRateLimit)}`, 'whatsapp');
    
    // Notificar os clientes sobre a mudança de configuração
    this.broadcastToClients({
      type: 'RATE_LIMIT_UPDATED',
      payload: this.messagingRateLimit
    });
    
    return this.getRateLimitSettings();
  }
  
  // Método para obter as configurações atuais de rate limiting
  getRateLimitSettings() {
    return { ...this.messagingRateLimit };
  }
  
  async initializeClient(): Promise<void> {
    try {
      if (this.client) {
        this.client.destroy();
        this.client = null;
      }

      log('Initializing WhatsApp client', 'whatsapp');
      
      // Configuração do puppeteer com múltiplas opções para compatibilidade
      const puppeteerOptions = {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage', 
          '--disable-accelerated-2d-canvas', 
          '--no-first-run', 
          '--no-zygote', 
          '--single-process'
        ]
      };
      
      // Detectar se estamos em ambiente Replit ou produção
      // e tentar usar um caminho de execução específico apenas se necessário
      if (process.env.NODE_ENV === 'production') {
        try {
          // Em produção, tentar usar a localização específica do Chromium no Replit
          const { execSync } = require('child_process');
          const chromiumPath = execSync('which chromium-browser || which chromium || which chrome').toString().trim();
          
          if (chromiumPath) {
            log(`Usando Chromium em: ${chromiumPath}`, 'whatsapp');
            Object.assign(puppeteerOptions, { executablePath: chromiumPath });
          }
        } catch (error) {
          log(`Não foi possível localizar Chromium, usando binário padrão: ${error}`, 'whatsapp');
        }
      }
      
      this.client = new Client({
        puppeteer: puppeteerOptions
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

  // Método principal para enviar mensagens - usa fila com rate limiting
  async sendMessage(
    to: string, 
    content: string, 
    recipientName: string | null = null, 
    mediaPath: string | null = null, 
    mediaType: string | null = null, 
    mediaCaption: string | null = null
  ): Promise<string> {
    if (!this.client || !this.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }
    
    // Se o rate limiting estiver desativado, enviar diretamente
    if (!this.messagingRateLimit.isEnabled) {
      return this._sendMessageDirectly(to, content, recipientName, mediaPath, mediaType, mediaCaption);
    }

    // Caso contrário, adicionar à fila e processar em lotes
    return new Promise((resolve, reject) => {
      this.messageQueue.push({
        to,
        content,
        recipientName,
        mediaPath,
        mediaType,
        mediaCaption,
        resolve,
        reject
      });
      
      // Iniciar o processamento da fila se não estiver em andamento
      if (!this.isProcessingQueue) {
        this.processMessageQueue();
      }
    });
  }
  
  // Processador de fila de mensagens com rate limiting
  private async processMessageQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    log(`Iniciando processamento de fila: ${this.messageQueue.length} mensagens`, 'whatsapp');
    
    try {
      // Processar a fila em lotes
      while (this.messageQueue.length > 0) {
        // Extrair o próximo lote (até messagesPerBatch)
        const batch = this.messageQueue.splice(0, Math.min(this.messageQueue.length, this.messagingRateLimit.messagesPerBatch));
        log(`Processando lote de ${batch.length} mensagens`, 'whatsapp');
        
        // Enviar cada mensagem do lote com um atraso entre elas
        for (let i = 0; i < batch.length; i++) {
          const { to, content, recipientName, mediaPath, mediaType, mediaCaption, resolve, reject } = batch[i];
          
          try {
            // Enviar a mensagem diretamente
            const messageId = await this._sendMessageDirectly(to, content, recipientName, mediaPath, mediaType, mediaCaption);
            resolve(messageId);
            
            // Atualizar UI com status
            this.broadcastToClients({
              type: 'QUEUE_PROGRESS',
              payload: {
                queueSize: this.messageQueue.length,
                currentBatchProgress: i + 1,
                totalBatchSize: batch.length,
                status: 'processing'
              }
            });
            
            // Aplicar atraso entre mensagens (exceto a última do lote)
            if (i < batch.length - 1) {
              log(`Aguardando ${this.messagingRateLimit.delayBetweenMessages}ms antes da próxima mensagem`, 'whatsapp');
              await new Promise(resolve => setTimeout(resolve, this.messagingRateLimit.delayBetweenMessages));
            }
          } catch (error) {
            log(`Erro ao enviar mensagem na fila: ${error}`, 'whatsapp');
            reject(error as Error);
          }
        }
        
        // Se ainda houver mensagens na fila, aguardar um tempo entre lotes
        if (this.messageQueue.length > 0) {
          log(`Lote completo. Aguardando ${this.messagingRateLimit.delayBetweenBatches}ms antes do próximo lote...`, 'whatsapp');
          
          // Informar aos clientes que estamos em pausa entre lotes
          this.broadcastToClients({
            type: 'QUEUE_BATCH_PAUSE',
            payload: {
              queueSize: this.messageQueue.length,
              pauseDuration: this.messagingRateLimit.delayBetweenBatches,
              reason: 'Pausa entre lotes para evitar bloqueio do WhatsApp'
            }
          });
          
          await new Promise(resolve => setTimeout(resolve, this.messagingRateLimit.delayBetweenBatches));
        }
      }
      
      log('Processamento da fila concluído com sucesso', 'whatsapp');
      this.broadcastToClients({
        type: 'QUEUE_COMPLETE',
        payload: { success: true }
      });
    } catch (error) {
      log(`Erro ao processar fila de mensagens: ${error}`, 'whatsapp');
      this.broadcastToClients({
        type: 'QUEUE_ERROR',
        payload: { error: (error as Error).message }
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }
  
  // Método interno para envio direto de mensagens sem rate limiting
  private async _sendMessageDirectly(
    to: string, 
    content: string, 
    recipientName: string | null = null, 
    mediaPath: string | null = null, 
    mediaType: string | null = null, 
    mediaCaption: string | null = null
  ): Promise<string> {
    try {
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
