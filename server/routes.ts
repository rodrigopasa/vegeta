import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage as dbStorage } from "./storage";
import { whatsAppService } from "./whatsapp";
import { messageWithValidationSchema, insertUserSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import passport from "passport";
import { setupAuth, hashPassword } from "./auth";
import { pool } from "./db";
import multer from "multer";
import path from "path";
import fs from "fs";

// Importar os serviços para chatbot, Google Sheets e Google Calendar
import { chatbotService } from "./services/chatbot-service";
import { googleSheetsService } from "./services/google-sheets-service";
import { googleCalendarService } from "./services/google-calendar-service";

// Importar funções para gerenciar configurações do Google
import { 
  getCalendarConfig, 
  getSheetsConfig, 
  initializeCalendar, 
  initializeSheets 
} from "./routes/google-integrations";

// Configurar o armazenamento de arquivos com Multer
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Verifica se o diretório de uploads existe, se não, cria
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gera um nome de arquivo único com timestamp e extensão original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

// Filtro para verificar tipos de arquivos permitidos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Aceitar imagens, documentos, vídeos e áudios
  const allowedTypes = [
    // Imagens
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
    // Documentos
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    // Áudio
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    // Vídeo
    'video/mp4', 'video/webm', 'video/quicktime'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
  }
};

// Configurar o middleware do multer
const upload = multer({ 
  storage: uploadStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // Limite de 50MB
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Primeiro, configurar a autenticação para que req.login esteja disponível
  setupAuth(app);
  
  // Rota para verificar a contagem de usuários (pública, sem autenticação)
  app.get("/api/users/count", async (req: Request, res: Response) => {
    try {
      const count = await dbStorage.getUserCount();
      // Log para debug
      console.log("User count:", count);
      res.json({ count });
    } catch (error) {
      console.error("Erro ao contar usuários:", error);
      res.status(500).json({ error: 'Erro ao contar usuários' });
    }
  });
  
  // Rota de teste para resetar senha (APENAS PARA DESENVOLVIMENTO)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/reset-password", async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
        }
        
        const user = await dbStorage.getUserByUsername(username);
        if (!user) {
          return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Hash da nova senha
        const hashedPassword = await hashPassword(password);
        
        // Atualizar a senha no banco de dados
        await pool.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [hashedPassword, user.id]
        );
        
        console.log(`Senha alterada para o usuário ${username}`);
        res.json({ success: true, message: `Senha alterada para o usuário ${username}` });
      } catch (error) {
        console.error('Erro ao resetar senha:', error);
        res.status(500).json({ error: 'Erro ao resetar senha', details: (error as Error).message });
      }
    });
  }
  
  // Rota para registrar um novo usuário (pública, apenas se não houver usuários existentes)
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      // Verificar se já existe algum usuário
      const count = await dbStorage.getUserCount();
      if (count > 0) {
        return res.status(403).json({ error: 'Registro não permitido. Já existe um administrador.' });
      }

      // Validar dados do usuário
      const userData = insertUserSchema.parse(req.body);
      
      // Hash da senha antes de salvar
      const hashedPassword = await hashPassword(userData.password);
      
      // Cria o usuário
      const user = await dbStorage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Fazer login com o usuário criado
      req.login(user, (err) => {
        if (err) {
          console.error('Erro no login após registro:', err);
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
  
  // Rota especial para forçar o registro de um administrador (funciona mesmo se já existirem usuários)
  app.post("/api/force-register-admin", async (req: Request, res: Response) => {
    try {
      // Validar dados do usuário
      const userData = insertUserSchema.parse(req.body);
      
      // Hash da senha antes de salvar
      const hashedPassword = await hashPassword(userData.password);
      
      // Cria o usuário admin
      const user = await dbStorage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      return res.status(201).json({ 
        id: user.id,
        username: user.username,
        message: "Administrador criado com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao criar administrador:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      return res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Definir as rotas públicas da API
  const publicApiRoutes = [
    '/api/login', 
    '/api/register', 
    '/api/force-register-admin', 
    '/api/users/count',
    '/api/user',
    '/api/reset-password',
    '/api/calendar/config',
    '/api/calendar/initialize',
    '/api/sheets/config',
    '/api/sheets/initialize',
    '/api/calendar/appointments',
    '/api/sheets/contacts',
  ];
  
  // Os endpoints da API devem ser protegidos mas retornar 401 em vez de redirecionar
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Verifica se é uma rota pública, API Google ou se está autenticado
    if (publicApiRoutes.includes(req.path) || 
        req.path.startsWith('/api/calendar') ||
        req.path.startsWith('/api/sheets') ||
        req.isAuthenticated()) {
      return next();
    }
    
    // Retorna 401 para APIs não autenticadas
    res.status(401).json({ error: 'Unauthorized' });
  });
  
  // Rota direta para acessar a página de integrações Google
  app.get("/direct-access-google", (req: Request, res: Response) => {
    const currentFilePath = new URL(import.meta.url).pathname;
    const currentDir = path.dirname(currentFilePath);
    const directAccessPath = path.resolve(currentDir, '../client/direct-access-google.html');
    
    console.log('Serving direct access Google page from path:', directAccessPath);
    
    if (fs.existsSync(directAccessPath)) {
      res.sendFile(directAccessPath);
    } else {
      res.redirect('/google-integrations');
    }
  });

  // Rota direta para a página de login estática
  app.get("/static-login.html", (req: Request, res: Response) => {
    // Em ES modules, __dirname não está definido, então precisamos usar import.meta.url
    const currentFilePath = new URL(import.meta.url).pathname;
    const currentDir = path.dirname(currentFilePath);
    
    // Usando path.resolve para garantir que o caminho esteja correto em produção e desenvolvimento
    const staticLoginPath = path.resolve(currentDir, '../client/static-login.html');
    console.log('Serving static login from path:', staticLoginPath);
    
    // Checando se o arquivo existe antes de tentar servi-lo
    if (fs.existsSync(staticLoginPath)) {
      res.sendFile(staticLoginPath);
    } else {
      // Falha: tentar outros caminhos alternativos
      console.error('Arquivo static-login.html não encontrado em:', staticLoginPath);
      
      // Tentar outras alternativas
      const possiblePaths = [
        path.resolve(currentDir, '../static-login.html'),
        path.resolve(process.cwd(), 'client/static-login.html'),
        path.resolve(process.cwd(), 'static-login.html')
      ];
      
      // Tentar cada caminho alternativo
      for (const altPath of possiblePaths) {
        if (fs.existsSync(altPath)) {
          console.log('Arquivo encontrado em caminho alternativo:', altPath);
          return res.sendFile(altPath);
        }
      }
      
      // Se nenhum caminho funcionar, criar uma página de login simples dinamicamente
      res.send(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PaZap - Login</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(to bottom, #128C7E, #075E54);
                  display: flex; justify-content: center; align-items: center; height: 100vh; color: #333; }
            .container { background-color: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); width: 350px; }
            h1 { text-align: center; color: #128C7E; margin-bottom: 1.5rem; }
            .form-group { margin-bottom: 1rem; }
            label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
            input { width: 100%; padding: 0.75rem; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px; }
            button { width: 100%; padding: 0.75rem; background-color: #128C7E; color: white; border: none;
                    border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 1rem; }
            button:hover { background-color: #075E54; }
            .error-message { color: #e74c3c; margin-top: 1rem; text-align: center; display: none; }
            .footer { margin-top: 1.5rem; text-align: center; font-size: 0.8rem; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>PaZap</h1>
            <div id="login-form">
              <div class="form-group">
                <label for="username">Usuário</label>
                <input type="text" id="username" placeholder="Digite seu nome de usuário">
              </div>
              <div class="form-group">
                <label for="password">Senha</label>
                <input type="password" id="password" placeholder="Digite sua senha">
              </div>
              <button id="login-button">Entrar</button>
              <div id="error-message" class="error-message"></div>
            </div>
            <div class="footer">
              Disparador de Mensagens para WhatsApp<br>
              Desenvolvido Por Rodrigo Pasa
            </div>
          </div>
          <script>
            window.addEventListener('DOMContentLoaded', async function() {
              try {
                const countResponse = await fetch('/api/users/count');
                const { count } = await countResponse.json();
                const loginButton = document.getElementById('login-button');
                const pageTitle = document.querySelector('h1');
                
                if (count === 0) {
                  loginButton.textContent = 'Criar Conta Administrador';
                  pageTitle.textContent = 'PaZap - Criar Conta';
                  document.title = 'PaZap - Criar Conta Administrador';
                } else {
                  loginButton.textContent = 'Entrar';
                  pageTitle.textContent = 'PaZap - Login';
                }
              } catch (error) {
                console.error('Erro ao verificar usuários:', error);
              }
            });
          
            document.getElementById('login-button').addEventListener('click', async function() {
              const username = document.getElementById('username').value;
              const password = document.getElementById('password').value;
              const errorMessage = document.getElementById('error-message');
              
              if (!username || !password) {
                errorMessage.textContent = 'Por favor, preencha todos os campos';
                errorMessage.style.display = 'block';
                return;
              }
              
              try {
                const countResponse = await fetch('/api/users/count');
                const { count } = await countResponse.json();
                const endpoint = count === 0 ? '/api/register' : '/api/login';
                
                const response = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ username, password })
                });
                
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || (count === 0 ? 'Erro ao criar conta' : 'Credenciais inválidas'));
                }
                
                const userData = await response.json();
                
                errorMessage.textContent = count === 0 
                  ? 'Conta criada com sucesso! Redirecionando...' 
                  : 'Login realizado com sucesso! Redirecionando...';
                errorMessage.style.display = 'block';
                errorMessage.style.color = '#27ae60';
                
                setTimeout(() => {
                  window.location.href = '/';
                }, 1000);
                
              } catch (error) {
                console.error("Erro:", error);
                errorMessage.textContent = error.message || 'Ocorreu um erro ao processar sua solicitação';
                errorMessage.style.display = 'block';
                errorMessage.style.color = '#e74c3c';
              }
            });
          </script>
        </body>
        </html>
      `);
    }
  });
  
  // ANTES DO MIDDLEWARE: Endpoint para resetar usuários (não protegido)
  app.post("/reset-database", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Este endpoint só está disponível em ambiente de desenvolvimento' });
    }
    
    try {
      // Executar uma query SQL para truncar a tabela de usuários
      await pool.query('TRUNCATE TABLE "users" CASCADE');
      console.log("🔧 Base de dados resetada com sucesso!");
      return res.json({ success: true, message: 'Base de dados resetada com sucesso' });
    } catch (error) {
      console.error("Erro ao resetar a base de dados:", error);
      return res.status(500).json({ error: 'Erro ao resetar a base de dados', details: (error as Error).message });
    }
  });

  // Substituir o comportamento do middleware de proteção de rotas
  // para redirecionar para a página estática em vez de retornar erro 401
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Se a rota já foi processada ou é pública, ou o usuário está autenticado
    if (req.path === '/static-login.html' || 
        req.path === '/reset-database' ||
        req.path === '/direct-access-google' ||
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
      isConnected: whatsAppService.isConnected,
      rateLimitSettings: whatsAppService.getRateLimitSettings()
    });
  });
  
  // Rota para configurar o sistema de rate limiting
  app.post("/api/whatsapp/rate-limit", (req: Request, res: Response) => {
    try {
      const settings = req.body;
      whatsAppService.setRateLimit(settings);
      res.json({
        success: true,
        settings: whatsAppService.getRateLimitSettings()
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Rotas para configurações de notificação
  app.get("/api/whatsapp/notification-settings", (req: Request, res: Response) => {
    try {
      const settings = whatsAppService.getNotificationSettings();
      res.json({
        success: true,
        settings
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post("/api/whatsapp/notification-settings", (req: Request, res: Response) => {
    try {
      const settings = req.body;
      whatsAppService.setNotificationSettings(settings);
      res.json({
        success: true,
        settings: whatsAppService.getNotificationSettings()
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
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
  
  // Rota para upload de arquivos
  app.post("/api/upload", upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }
      
      // Obter informações do arquivo
      const file = req.file;
      const filePath = path.join(process.cwd(), file.path);
      const fileType = file.mimetype.split('/')[0]; // image, application, video, audio
      
      // Determinar o tipo de mídia
      let mediaType = 'document';
      if (fileType === 'image') mediaType = 'image';
      else if (fileType === 'video') mediaType = 'video';
      else if (fileType === 'audio') mediaType = 'audio';
      
      res.json({
        success: true,
        file: {
          path: filePath,
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
          mediaType: mediaType
        }
      });
    } catch (error) {
      console.error('Erro ao fazer upload de arquivo:', error);
      res.status(500).json({ 
        message: 'Erro ao fazer upload de arquivo', 
        error: (error as Error).message 
      });
    }
  });

  // Esta rota foi movida para cima
  
  // Contacts API Routes
  app.get("/api/contacts", async (req: Request, res: Response) => {
    try {
      const contacts = await dbStorage.getContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Messages API Routes
  app.get("/api/messages", async (req: Request, res: Response) => {
    try {
      const messages = await dbStorage.getMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/messages/scheduled", async (req: Request, res: Response) => {
    try {
      const messages = await dbStorage.getScheduledMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/messages", async (req: Request, res: Response) => {
    try {
      // Validate message data
      const messageData = messageWithValidationSchema.parse(req.body);
      
      // Create message in storage with media information if available
      const message = await dbStorage.createMessage({
        content: messageData.content,
        recipient: messageData.recipient,
        recipientName: messageData.recipientName,
        scheduledFor: messageData.scheduledFor,
        isGroup: messageData.isGroup || false,
        hasMedia: messageData.hasMedia || false,
        mediaType: messageData.mediaType,
        mediaPath: messageData.mediaPath,
        mediaName: messageData.mediaName,
        mediaCaption: messageData.mediaCaption
      });

      // If no scheduled time or it's immediate, send right away
      if (!messageData.scheduledFor) {
        try {
          const messageId = await whatsAppService.sendMessage(
            messageData.recipient,
            messageData.content,
            messageData.recipientName,
            messageData.mediaPath || null,
            messageData.mediaType || null,
            messageData.mediaCaption || null
          );
          
          // Update message status to sent
          await dbStorage.updateMessage(message.id, {
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
          await dbStorage.updateMessage(message.id, {
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
      
      const success = await dbStorage.deleteMessage(messageId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Message not found" });
      }
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // ===== Rotas para configuração do chatbot =====
  
  // Armazenamento em memória para configurações do chatbot (em produção, use banco de dados)
  const chatbotSettings = {
    prompt: `Você é um assistente virtual de uma empresa. Ajude os clientes de forma educada e profissional.
  
Suas principais funções são:
1. Responder dúvidas sobre produtos e serviços
2. Agendar consultas ou compromissos
3. Capturar informações de contato para o CRM

Quando o cliente quiser agendar um compromisso, colete estas informações:
- Nome completo
- Data e horário desejados
- Tipo de serviço
- Número de telefone para confirmação
- Email (opcional)

Horários disponíveis para agendamento: segunda a sexta, das 8h às 18h.

Seja conciso, educado e solícito.`,
    services: [],
    schedules: [],
    faqs: [],
    fullPrompt: ''
  };
  
  // Rota para obter prompt principal
  app.get("/api/chatbot/settings/prompt", (req: Request, res: Response) => {
    res.json({ prompt: chatbotSettings.prompt });
  });
  
  // Rota para atualizar prompt principal
  app.post("/api/chatbot/settings/prompt", (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt inválido' });
      }
      
      chatbotSettings.prompt = prompt;
      
      // Atualizar o prompt completo também
      chatbotSettings.fullPrompt = prompt;
      
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao atualizar prompt:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Rota para obter serviços
  app.get("/api/chatbot/settings/services", (req: Request, res: Response) => {
    res.json(chatbotSettings.services);
  });
  
  // Rota para atualizar serviços
  app.post("/api/chatbot/settings/services", (req: Request, res: Response) => {
    try {
      const services = req.body;
      
      if (!Array.isArray(services)) {
        return res.status(400).json({ error: 'Formato inválido. Esperado um array.' });
      }
      
      chatbotSettings.services = services;
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao atualizar serviços:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Rota para obter horários
  app.get("/api/chatbot/settings/schedules", (req: Request, res: Response) => {
    res.json(chatbotSettings.schedules);
  });
  
  // Rota para atualizar horários
  app.post("/api/chatbot/settings/schedules", (req: Request, res: Response) => {
    try {
      const schedules = req.body;
      
      if (!Array.isArray(schedules)) {
        return res.status(400).json({ error: 'Formato inválido. Esperado um array.' });
      }
      
      chatbotSettings.schedules = schedules;
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao atualizar horários:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Rota para obter FAQs
  app.get("/api/chatbot/settings/faqs", (req: Request, res: Response) => {
    res.json(chatbotSettings.faqs);
  });
  
  // Rota para atualizar FAQs
  app.post("/api/chatbot/settings/faqs", (req: Request, res: Response) => {
    try {
      const faqs = req.body;
      
      if (!Array.isArray(faqs)) {
        return res.status(400).json({ error: 'Formato inválido. Esperado um array.' });
      }
      
      chatbotSettings.faqs = faqs;
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao atualizar FAQs:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Rota para atualizar o prompt completo (combinando todas as configurações)
  app.post("/api/chatbot/settings/full-prompt", (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt inválido' });
      }
      
      chatbotSettings.fullPrompt = prompt;
      
      // Atualizar também no serviço de IA
      // Em uma implementação completa, você atualizaria o prompt do sistema no serviço de IA
      
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao atualizar prompt completo:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // === Rotas para Chatbot Inteligente ===
  
  // Processar mensagem do chatbot
  app.post("/api/chatbot/message", async (req: Request, res: Response) => {
    try {
      const { message, phoneNumber, name } = req.body;
      
      if (!message || !phoneNumber) {
        return res.status(400).json({ error: 'Mensagem e número de telefone são obrigatórios' });
      }
      
      const response = await chatbotService.processMessage({
        message,
        phoneNumber,
        name
      });
      
      res.json(response);
    } catch (error) {
      console.error('Erro ao processar mensagem do chatbot:', error);
      res.status(500).json({ 
        error: 'Erro ao processar mensagem do chatbot', 
        details: (error as Error).message 
      });
    }
  });
  
  // === Rotas para Google Sheets (CRM) ===
  
  // Obter configuração atual do Google Sheets
  app.get("/api/sheets/config", async (req: Request, res: Response) => {
    try {
      await getSheetsConfig(req, res);
    } catch (error) {
      console.error('Erro ao obter configuração do Google Sheets:', error);
      res.status(500).json({ 
        error: 'Erro ao obter configuração do Google Sheets', 
        details: (error as Error).message 
      });
    }
  });
  
  // Inicializar conexão com Google Sheets
  app.post("/api/sheets/initialize", async (req: Request, res: Response) => {
    try {
      // Verificar se as credenciais Google estão configuradas
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      
      if (!clientEmail || !privateKey) {
        return res.status(400).json({ 
          error: 'Credenciais do Google não configuradas', 
          requiredCredentials: ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'] 
        });
      }
      
      // Chamar a função de inicialização do Google Sheets com o ID da planilha personalizado
      await initializeSheets(req, res);
    } catch (error) {
      console.error('Erro ao inicializar Google Sheets:', error);
      res.status(500).json({ 
        error: 'Erro ao inicializar Google Sheets', 
        details: (error as Error).message 
      });
    }
  });
  
  // Adicionar contato ao Google Sheets
  app.post("/api/sheets/contacts", async (req: Request, res: Response) => {
    try {
      const { name, phoneNumber, email, notes } = req.body;
      
      if (!name || !phoneNumber) {
        return res.status(400).json({ error: 'Nome e número de telefone são obrigatórios' });
      }
      
      const contactId = await googleSheetsService.addContact({
        name,
        phoneNumber,
        email,
        notes,
        createdAt: new Date()
      });
      
      if (contactId) {
        res.json({ success: true, contactId });
      } else {
        res.status(500).json({ error: 'Falha ao adicionar contato ao Google Sheets' });
      }
    } catch (error) {
      console.error('Erro ao adicionar contato ao Google Sheets:', error);
      res.status(500).json({ 
        error: 'Erro ao adicionar contato ao Google Sheets', 
        details: (error as Error).message 
      });
    }
  });
  
  // === Rotas para Google Calendar (Agendamentos) ===
  
  // Obter configuração atual do Google Calendar
  app.get("/api/calendar/config", async (req: Request, res: Response) => {
    try {
      await getCalendarConfig(req, res);
    } catch (error) {
      console.error('Erro ao obter configuração do Google Calendar:', error);
      res.status(500).json({ 
        error: 'Erro ao obter configuração do Google Calendar', 
        details: (error as Error).message 
      });
    }
  });
  
  // Inicializar conexão com Google Calendar
  app.post("/api/calendar/initialize", async (req: Request, res: Response) => {
    try {
      // Verificar se as credenciais Google estão configuradas
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      
      if (!clientEmail || !privateKey) {
        return res.status(400).json({ 
          error: 'Credenciais do Google não configuradas', 
          requiredCredentials: ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'] 
        });
      }
      
      // Chamar a função de inicialização do Google Calendar com o ID do calendário personalizado
      await initializeCalendar(req, res);
    } catch (error) {
      console.error('Erro ao inicializar Google Calendar:', error);
      res.status(500).json({ 
        error: 'Erro ao inicializar Google Calendar', 
        details: (error as Error).message 
      });
    }
  });
  
  // Verificar disponibilidade de horário
  app.post("/api/calendar/check-availability", async (req: Request, res: Response) => {
    try {
      const { startTime, endTime } = req.body;
      
      if (!startTime || !endTime) {
        return res.status(400).json({ error: 'Horário de início e término são obrigatórios' });
      }
      
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      const isAvailable = await googleCalendarService.checkAvailability(start, end);
      
      res.json({ available: isAvailable });
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      res.status(500).json({ 
        error: 'Erro ao verificar disponibilidade', 
        details: (error as Error).message 
      });
    }
  });
  
  // Criar um novo agendamento
  app.post("/api/calendar/appointments", async (req: Request, res: Response) => {
    try {
      const { 
        summary, 
        description, 
        location, 
        startTime, 
        endTime, 
        attendeeEmail, 
        attendeeName, 
        attendeePhone,
        contactId 
      } = req.body;
      
      if (!summary || !startTime || !endTime) {
        return res.status(400).json({ error: 'Título, horário de início e término são obrigatórios' });
      }
      
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      // Primeiro criar no Google Calendar
      const googleEventId = await googleCalendarService.createAppointment({
        summary,
        description,
        location,
        startTime: start,
        endTime: end,
        attendeeEmail,
        attendeeName,
        attendeePhone
      });
      
      if (!googleEventId) {
        return res.status(500).json({ error: 'Falha ao criar evento no Google Calendar' });
      }
      
      // Depois salvar no banco de dados
      if (contactId) {
        const insertAppointment = {
          contactId: parseInt(contactId),
          title: summary,
          description,
          startTime: start,
          endTime: end,
          googleEventId,
          status: 'scheduled'
        };
        
        const appointment = await dbStorage.createAppointment(insertAppointment);
        
        res.json({ 
          success: true, 
          appointmentId: appointment.id,
          googleEventId 
        });
      } else {
        res.json({ 
          success: true, 
          googleEventId 
        });
      }
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      res.status(500).json({ 
        error: 'Erro ao criar agendamento', 
        details: (error as Error).message 
      });
    }
  });
  
  // Obter agendamentos por período
  app.get("/api/calendar/appointments", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Data de início e término são obrigatórias' });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Buscar no banco de dados
      const appointments = await dbStorage.getAppointmentsByDateRange(start, end);
      
      res.json(appointments);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar agendamentos', 
        details: (error as Error).message 
      });
    }
  });
  
  // Cancelar agendamento
  app.delete("/api/calendar/appointments/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }
      
      // Buscar agendamento no banco de dados
      const appointment = await dbStorage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }
      
      // Cancelar no Google Calendar se tiver ID do evento
      if (appointment.googleEventId) {
        await googleCalendarService.cancelAppointment(appointment.googleEventId);
      }
      
      // Remover do banco de dados
      const success = await dbStorage.deleteAppointment(id);
      if (!success) {
        return res.status(500).json({ error: 'Falha ao remover agendamento do banco de dados' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      res.status(500).json({ 
        error: 'Erro ao cancelar agendamento', 
        details: (error as Error).message 
      });
    }
  });

  return httpServer;
}
