import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { whatsAppService } from "./whatsapp";
import { messageWithValidationSchema, insertUserSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import passport from "passport";
import { setupAuth, hashPassword } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Definir as rotas públicas antes de configurar autenticação
  
  // Rota para verificar a contagem de usuários (pública, sem autenticação)
  app.get("/api/users/count", async (req: Request, res: Response) => {
    try {
      const count = await storage.getUserCount();
      // Log para debug
      console.log("User count:", count);
      res.json({ count });
    } catch (error) {
      console.error("Erro ao contar usuários:", error);
      res.status(500).json({ error: 'Erro ao contar usuários' });
    }
  });
  
  // Rota para registrar um novo usuário (pública, apenas se não houver usuários existentes)
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      // Verificar se já existe algum usuário
      const count = await storage.getUserCount();
      if (count > 0) {
        return res.status(403).json({ error: 'Registro não permitido. Já existe um administrador.' });
      }

      // Validar dados do usuário
      const userData = insertUserSchema.parse(req.body);
      
      // Hash da senha antes de salvar
      const hashedPassword = await hashPassword(userData.password);
      
      // Cria o usuário e faz login
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Erro ao fazer login após registro' });
        }
        res.status(201).json(user);
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ error: validationError.message });
      } else {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  // Configurar autenticação
  setupAuth(app);
  
  // Definir as rotas públicas da API
  const publicApiRoutes = [
    '/api/login', 
    '/api/register', 
    '/api/users/count',
    '/api/user'
  ];
  
  // Os endpoints da API devem ser protegidos mas retornar 401 em vez de redirecionar
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Verifica se é uma rota pública ou se está autenticado
    if (publicApiRoutes.includes(req.path) || req.isAuthenticated()) {
      return next();
    }
    
    // Retorna 401 para APIs não autenticadas
    res.status(401).json({ error: 'Unauthorized' });
  });
  
  // Rota direta para a página de login estática
  app.get("/static-login.html", (req: Request, res: Response) => {
    res.sendFile("static-login.html", { root: "./client" });
  });
  
  // Substituir o comportamento do middleware de proteção de rotas
  // para redirecionar para a página estática em vez de retornar erro 401
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Se a rota já foi processada ou é pública, ou o usuário está autenticado
    if (req.path === '/static-login.html' || 
        req.path.startsWith('/api/') || 
        req.path.endsWith('.js') || 
        req.path.endsWith('.css') ||
        req.path.endsWith('.svg') ||
        req.path.endsWith('.png') ||
        req.path.endsWith('.ico') ||
        req.isAuthenticated()) {
      return next();
    }
    
    // Redirecionar para a página de login estática
    return res.redirect('/static-login.html');
  });

  const httpServer = createServer(app);
  
  // Setup WebSockets
  whatsAppService.setupWebSockets(httpServer);

  // WhatsApp API Routes
  app.get("/api/whatsapp/status", (req: Request, res: Response) => {
    res.json({
      isInitialized: whatsAppService.isInitialized,
      isConnected: whatsAppService.isConnected
    });
  });

  app.get("/api/whatsapp/qr-code", (req: Request, res: Response) => {
    const qrCode = whatsAppService.getQRCode();
    if (qrCode) {
      res.json({ qrCode });
    } else {
      res.status(404).json({ message: "QR code not available" });
    }
  });

  app.post("/api/whatsapp/initialize", async (req: Request, res: Response) => {
    try {
      await whatsAppService.initializeClient();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/whatsapp/refresh-contacts", async (req: Request, res: Response) => {
    try {
      await whatsAppService.refreshContacts();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Contacts API Routes
  app.get("/api/contacts", async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Messages API Routes
  app.get("/api/messages", async (req: Request, res: Response) => {
    try {
      const messages = await storage.getMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/messages/scheduled", async (req: Request, res: Response) => {
    try {
      const messages = await storage.getScheduledMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/messages", async (req: Request, res: Response) => {
    try {
      // Validate message data
      const messageData = messageWithValidationSchema.parse(req.body);
      
      // Create message in storage
      const message = await storage.createMessage({
        content: messageData.content,
        recipient: messageData.recipient,
        recipientName: messageData.recipientName,
        scheduledFor: messageData.scheduledFor,
        isGroup: messageData.isGroup || false
      });

      // If no scheduled time or it's immediate, send right away
      if (!messageData.scheduledFor) {
        try {
          const messageId = await whatsAppService.sendMessage(
            messageData.recipient,
            messageData.content,
            messageData.recipientName
          );
          
          // Update message status to sent
          await storage.updateMessage(message.id, {
            status: "sent",
            sentAt: new Date()
          });
          
          // Enviar notificação de sucesso para o número de administrador
          try {
            await whatsAppService.sendStatusNotification(true, message);
          } catch (error) {
            console.error('Failed to send status notification:', error);
            // Não propagamos o erro para não interromper o fluxo principal
          }
          
          res.json({ ...message, status: "sent", sentAt: new Date() });
        } catch (error) {
          // Update message status to failed
          await storage.updateMessage(message.id, {
            status: "failed",
            errorMessage: (error as Error).message
          });
          
          // Enviar notificação de falha para o número de administrador
          try {
            await whatsAppService.sendStatusNotification(false, message, (error as Error).message);
          } catch (notifError) {
            console.error('Failed to send failure notification:', notifError);
            // Não propagamos o erro para não interromper o fluxo principal
          }
          
          res.status(500).json({
            message: `Message created but failed to send: ${(error as Error).message}`,
            messageId: message.id
          });
        }
      } else {
        res.json(message);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: (error as Error).message });
      }
    }
  });

  app.delete("/api/messages/:id", async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }
      
      const success = await storage.deleteMessage(messageId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Message not found" });
      }
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  return httpServer;
}
