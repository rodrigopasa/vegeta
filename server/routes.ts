import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { whatsAppService } from "./whatsapp";
import { messageWithValidationSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
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
            messageData.content
          );
          
          // Update message status to sent
          await storage.updateMessage(message.id, {
            status: "sent",
            sentAt: new Date()
          });
          
          res.json({ ...message, status: "sent", sentAt: new Date() });
        } catch (error) {
          // Update message status to failed
          await storage.updateMessage(message.id, {
            status: "failed",
            errorMessage: (error as Error).message
          });
          
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
