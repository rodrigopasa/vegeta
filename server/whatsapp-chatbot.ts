import { whatsAppService } from './whatsapp';
import { storage } from './storage';
import { chatbotService } from './services/chatbot-service';
import { log } from './vite';

/**
 * Serviço para integrar o chatbot com o WhatsApp
 */
class WhatsAppChatbotService {
  private isInitialized: boolean = false;
  private isProcessingMessage: boolean = false;
  
  // Mensagem padrão caso ocorra um erro ao processar uma mensagem
  private readonly errorMessage = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.";
  
  /**
   * Inicializa o serviço de chatbot do WhatsApp
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }
    
    try {
      // Verificar se o serviço do WhatsApp está conectado
      if (!whatsAppService.isConnected) {
        log('WhatsApp não está conectado. O chatbot não pode ser inicializado.', 'whatsapp-chatbot');
        return false;
      }
      
      // Registrar handlers para mensagens do WhatsApp
      this.registerMessageHandlers();
      
      log('Serviço de chatbot do WhatsApp inicializado com sucesso.', 'whatsapp-chatbot');
      this.isInitialized = true;
      return true;
    } catch (error) {
      log(`Erro ao inicializar o serviço de chatbot do WhatsApp: ${error}`, 'whatsapp-chatbot');
      return false;
    }
  }
  
  /**
   * Registra os manipuladores de eventos para mensagens do WhatsApp
   */
  private registerMessageHandlers() {
    // Só registra se o cliente existir e estiver conectado
    if (!whatsAppService.client) {
      log('Cliente do WhatsApp não está disponível para registro de eventos.', 'whatsapp-chatbot');
      return;
    }
    
    try {
      // Aqui estamos usando eventEmitter do serviço do WhatsApp
      // Em um ambiente de produção, você deve usar os eventos reais do whatsapp-web.js
      whatsAppService.client.on('message', async (message: any) => {
        await this.handleIncomingMessage(message);
      });
      
      log('Handlers de mensagens do WhatsApp registrados com sucesso.', 'whatsapp-chatbot');
    } catch (error) {
      log(`Erro ao registrar handlers de mensagens do WhatsApp: ${error}`, 'whatsapp-chatbot');
    }
  }
  
  /**
   * Processa mensagens recebidas do WhatsApp
   * @param message Mensagem recebida do WhatsApp
   */
  async handleIncomingMessage(message: any) {
    // Evitar processar mensagens enquanto outra está sendo processada
    if (this.isProcessingMessage) {
      log('Já existe uma mensagem sendo processada. Aguardando...', 'whatsapp-chatbot');
      return;
    }
    
    this.isProcessingMessage = true;
    
    try {
      // Extrair informações da mensagem
      const from = message.from; // Número do remetente
      const messageContent = message.body; // Conteúdo da mensagem
      const isGroup = message.isGroup; // Se é uma mensagem de grupo
      
      // Não processar mensagens de grupo (opcional)
      if (isGroup) {
        this.isProcessingMessage = false;
        return;
      }
      
      // Processar mensagens muito curtas ou comandos específicos
      if (messageContent.trim().length <= 2 || this.isCommand(messageContent)) {
        const response = this.handleShortMessageOrCommand(messageContent);
        if (response) {
          await this.sendResponse(from, response);
        }
        this.isProcessingMessage = false;
        return;
      }
      
      // Buscar informações do contato
      const contact = await this.getContactInfo(from);
      
      log(`Processando mensagem de ${contact.name || from}: ${messageContent}`, 'whatsapp-chatbot');
      
      // Processar a mensagem com o chatbot
      let chatbotResponse;
      
      try {
        chatbotResponse = await chatbotService.processMessage({
          message: messageContent,
          phoneNumber: from,
          name: contact.name
        });
      } catch (chatbotError) {
        // Se ocorrer erro no chatbot (como OpenAI não configurada), usar respostas padrão
        log(`Usando resposta padrão devido ao erro: ${chatbotError}`, 'whatsapp-chatbot');
        
        // Respostas genéricas para quando a IA não estiver disponível
        const defaultResponses = [
          `Olá ${contact.name || 'Cliente'}! Agradecemos seu contato. Neste momento, estou operando em modo básico e não consigo processar consultas avançadas.`,
          `Posso ajudar com informações simples sobre nossos serviços e horários. Para questões mais complexas, por favor, aguarde um atendente humano entrar em contato.`,
          `Nosso horário de funcionamento é de segunda a sexta, das 9h às 18h.`,
          `Para agendar um horário, por favor entre em contato pelo telefone principal da empresa.`,
          `Obrigado por sua mensagem. Um de nossos atendentes entrará em contato em breve!`
        ];
        
        // Selecionar uma resposta que tenha alguma relação com a pergunta, ou uma aleatória
        let selectedResponse = defaultResponses[0];
        
        const lowerMessage = messageContent.toLowerCase();
        if (lowerMessage.includes('horário') || lowerMessage.includes('aberto')) {
          selectedResponse = defaultResponses[2];
        } else if (lowerMessage.includes('agendar') || lowerMessage.includes('marcar')) {
          selectedResponse = defaultResponses[3];
        } else if (lowerMessage.includes('ajuda') || lowerMessage.includes('problema')) {
          selectedResponse = defaultResponses[1];
        } else {
          // Resposta padrão para mensagens que não correspondem a nenhum padrão
          selectedResponse = defaultResponses[4];
        }
        
        // Criar um objeto de resposta simples para manter a interface consistente
        chatbotResponse = {
          message: selectedResponse,
          sessionId: 'dev-session'
        };
      }
      
      // Enviar resposta
      await this.sendResponse(from, chatbotResponse.message);
      
      // Se um agendamento foi criado, enviar confirmação adicional
      if (chatbotResponse.appointmentCreated && chatbotResponse.appointmentDetails) {
        const confirmationMessage = this.createAppointmentConfirmation(chatbotResponse.appointmentDetails);
        await this.sendResponse(from, confirmationMessage);
      }
      
      log(`Resposta enviada para ${contact.name || from}`, 'whatsapp-chatbot');
    } catch (error) {
      log(`Erro ao processar mensagem do WhatsApp: ${error}`, 'whatsapp-chatbot');
      
      try {
        // Enviar mensagem de erro para o remetente
        await this.sendResponse(message.from, this.errorMessage);
      } catch (sendError) {
        log(`Erro ao enviar mensagem de erro: ${sendError}`, 'whatsapp-chatbot');
      }
    } finally {
      this.isProcessingMessage = false;
    }
  }
  
  /**
   * Verifica se a mensagem é um comando específico
   * @param message Conteúdo da mensagem
   * @returns true se for um comando, false caso contrário
   */
  private isCommand(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    
    // Lista de comandos especiais
    const commands = [
      '/ajuda', '/help',
      '/menu', '/opcoes',
      '/agendar', '/horarios',
      '/servicos', '/precos',
      '/contato', '/cancelar'
    ];
    
    return commands.some(cmd => lowerMessage === cmd);
  }
  
  /**
   * Processa mensagens curtas ou comandos específicos
   * @param message Conteúdo da mensagem
   * @returns Resposta para a mensagem ou null se não for processada
   */
  private handleShortMessageOrCommand(message: string): string | null {
    const lowerMessage = message.toLowerCase().trim();
    
    switch (lowerMessage) {
      case '/ajuda':
      case '/help':
        return "🤖 *Assistente Virtual*\n\n" +
          "Olá! Sou o assistente virtual e posso te ajudar com informações sobre nossos serviços, agendamentos e muito mais.\n\n" +
          "*Comandos disponíveis:*\n" +
          "• */ajuda* - Mostra esta mensagem de ajuda\n" +
          "• */menu* - Mostra as opções disponíveis\n" +
          "• */agendar* - Iniciar processo de agendamento\n" +
          "• */horarios* - Consultar horários disponíveis\n" +
          "• */servicos* - Listar serviços oferecidos\n" +
          "• */contato* - Informações de contato\n\n" +
          "Você também pode conversar naturalmente comigo! 😊";
        
      case '/menu':
      case '/opcoes':
        return "🤖 *Menu Principal*\n\n" +
          "• Informações sobre serviços\n" +
          "• Agendamento de horários\n" +
          "• Preços e promoções\n" +
          "• Horários de funcionamento\n" +
          "• Dúvidas frequentes\n\n" +
          "Como posso te ajudar hoje?";
        
      case '/agendar':
        return "🗓️ *Agendamento*\n\n" +
          "Para agendar um horário, preciso das seguintes informações:\n\n" +
          "1. Qual serviço você deseja agendar?\n" +
          "2. Qual data e horário de preferência?\n" +
          "3. Seu nome completo\n\n" +
          "Você pode me informar agora ou responder quando eu perguntar.";
        
      case '/horarios':
        return "⏰ *Horários de Atendimento*\n\n" +
          "Estamos disponíveis nos seguintes horários:\n\n" +
          "• Segunda a Sexta: 8h às 18h\n" +
          "• Sábados: 9h às 13h\n" +
          "• Domingos e Feriados: Fechado\n\n" +
          "Deseja agendar um horário?";
        
      case 'oi':
      case 'olá':
      case 'ola':
      case 'bom dia':
      case 'boa tarde':
      case 'boa noite':
      case 'hi':
      case 'hello':
        return "Olá! 👋 Eu sou o assistente virtual. Como posso ajudar você hoje?";
      
      default:
        if (lowerMessage.length <= 2) {
          return "Olá! Não entendi sua mensagem. Para uma lista de comandos disponíveis, digite /ajuda.";
        }
        return null;
    }
  }
  
  /**
   * Busca ou cria informações de contato para um número
   * @param phoneNumber Número de telefone
   * @returns Informações do contato
   */
  private async getContactInfo(phoneNumber: string): Promise<{ name: string, id?: number }> {
    try {
      // Buscar contato existente
      const contact = await storage.getContactByPhone(phoneNumber);
      
      if (contact) {
        return {
          id: contact.id,
          name: contact.name
        };
      }
      
      // Se não existir, criar um contato básico com nome genérico
      // Em um ambiente de produção, você pode usar a API do WhatsApp para obter o nome do contato
      return {
        name: "Cliente"
      };
    } catch (error) {
      log(`Erro ao buscar informações de contato: ${error}`, 'whatsapp-chatbot');
      return {
        name: "Cliente"
      };
    }
  }
  
  /**
   * Envia uma resposta para um número do WhatsApp
   * @param to Número de destino
   * @param message Mensagem a ser enviada
   */
  private async sendResponse(to: string, message: string): Promise<void> {
    try {
      await whatsAppService.sendMessage(to, message);
    } catch (error) {
      log(`Erro ao enviar resposta para ${to}: ${error}`, 'whatsapp-chatbot');
      throw error;
    }
  }
  
  /**
   * Cria uma mensagem de confirmação de agendamento
   * @param appointmentDetails Detalhes do agendamento
   * @returns Mensagem formatada
   */
  private createAppointmentConfirmation(appointmentDetails: any): string {
    return `✅ *Agendamento Confirmado*\n\n` +
      `Seu agendamento para *${appointmentDetails.service}* foi confirmado com sucesso!\n\n` +
      `📅 *Data:* ${appointmentDetails.date}\n` +
      `⏰ *Horário:* ${appointmentDetails.time}\n\n` +
      `Você receberá uma notificação de lembrete 1 dia antes da sua consulta.\n\n` +
      `Para cancelar ou reagendar, responda com "/cancelar" ou entre em contato conosco.`;
  }
}

export const whatsAppChatbot = new WhatsAppChatbotService();