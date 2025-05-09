import { openAIService } from './openai-service';
import { googleSheetsService } from './google-sheets-service';
import { googleCalendarService } from './google-calendar-service';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../vite';

interface ChatbotRequest {
  message: string;
  phoneNumber: string;
  name?: string;
  sessionId?: string;
}

interface ChatbotResponse {
  message: string;
  appointmentCreated?: boolean;
  appointmentDetails?: {
    service: string;
    date: string;
    time: string;
    googleEventId?: string;
  };
  contactCreated?: boolean;
  contactId?: number;
  sessionId: string;
}

/**
 * Serviço para integração entre a API da OpenAI e outros serviços
 */
class ChatbotService {
  private defaultSystemPrompt: string = `Você é um assistente virtual profissional que trabalha para uma empresa.
Sua função é ajudar clientes com informações sobre serviços, preços e agendamentos.

Seja sempre educado, conciso e profissional. Não use frases muito longas.`;

  private fullPrompt: string = this.defaultSystemPrompt;

  async processMessage(request: ChatbotRequest): Promise<ChatbotResponse> {
    try {
      // Buscar ou criar sessão do chatbot
      const session = await this.getOrCreateSession(request);
      
      // Obter histórico de conversa da sessão
      const conversationHistory = this.parseConversationHistory(session.conversationHistory);
      
      // Adicionar a mensagem do usuário ao histórico
      conversationHistory.push({
        role: 'user',
        content: request.message
      });
      
      // Enviar para a OpenAI
      const openAIResponse = await openAIService.sendMessage(this.fullPrompt, conversationHistory);
      
      // Adicionar resposta ao histórico de conversa
      conversationHistory.push({
        role: 'assistant',
        content: openAIResponse
      });
      
      // Salvar histórico atualizado
      await this.updateSessionHistory(session.id, conversationHistory);
      
      // Verificar se há intenção de agendamento na mensagem
      const appointmentInfo = await this.checkForAppointmentIntent(request.message, openAIResponse);
      
      // Se detectou intenção de agendamento, processar
      let appointmentCreated = false;
      let appointmentDetails = undefined;
      
      if (appointmentInfo.isAppointmentIntent) {
        const result = await this.processAppointmentIntent(
          appointmentInfo, 
          request.phoneNumber, 
          request.name || 'Cliente'
        );
        
        appointmentCreated = result.created;
        appointmentDetails = result.details;
      }
      
      return {
        message: openAIResponse,
        appointmentCreated,
        appointmentDetails,
        sessionId: session.sessionId
      };
    } catch (error) {
      log(`Erro ao processar mensagem do chatbot: ${error}`, 'chatbot-service');
      throw error;
    }
  }
  
  /**
   * Busca ou cria uma sessão para o usuário
   */
  private async getOrCreateSession(request: ChatbotRequest): Promise<any> {
    try {
      let session;
      
      // Se um sessionId foi fornecido, buscar a sessão existente
      if (request.sessionId) {
        session = await storage.getChatbotSessionBySessionId(request.sessionId);
      }
      
      // Se não encontrou a sessão, buscar pelo número de telefone
      if (!session) {
        // Buscar contato pelo número de telefone
        let contact = await storage.getContactByPhone(request.phoneNumber);
        
        // Se não existir contato, criar um novo
        if (!contact) {
          contact = await storage.createContact({
            name: request.name || 'Cliente',
            phoneNumber: request.phoneNumber,
            email: null,
            notes: 'Criado pelo chatbot',
            isGroup: false,
            memberCount: null,
            createdAt: new Date()
          });
          
          // Adicionar contato ao Google Sheets
          try {
            await googleSheetsService.addContact({
              name: contact.name,
              phoneNumber: contact.phoneNumber,
              email: null,
              notes: 'Criado pelo chatbot',
              createdAt: new Date()
            });
          } catch (error) {
            log(`Erro ao adicionar contato ao Google Sheets: ${error}`, 'chatbot-service');
          }
        }
        
        // Agora que temos um contato, buscar sessões existentes
        const sessions = await storage.getChatbotSessionsByContactId(contact.id);
        
        // Usar a sessão mais recente, se existir
        if (sessions && sessions.length > 0) {
          session = sessions[0]; // Assumindo que a mais recente é a primeira
        } else {
          // Criar nova sessão
          const sessionId = uuidv4();
          session = await storage.createChatbotSession({
            contactId: contact.id,
            sessionId,
            conversationHistory: JSON.stringify([]),
            createdAt: new Date(),
            lastActivity: new Date()
          });
        }
      }
      
      return session;
    } catch (error) {
      log(`Erro ao buscar/criar sessão: ${error}`, 'chatbot-service');
      throw error;
    }
  }
  
  /**
   * Atualiza o histórico de conversa de uma sessão
   */
  private async updateSessionHistory(sessionId: number, conversationHistory: any[]): Promise<void> {
    try {
      await storage.updateChatbotSession(sessionId, {
        conversationHistory: JSON.stringify(conversationHistory),
        lastActivity: new Date()
      });
    } catch (error) {
      log(`Erro ao atualizar histórico de sessão: ${error}`, 'chatbot-service');
      throw error;
    }
  }
  
  /**
   * Converte o histórico de conversa de string para array
   */
  private parseConversationHistory(historyString: string): any[] {
    try {
      if (!historyString) return [];
      return JSON.parse(historyString);
    } catch (error) {
      log(`Erro ao parsear histórico de conversa: ${error}`, 'chatbot-service');
      return [];
    }
  }
  
  /**
   * Verifica se a mensagem contém intenção de agendamento
   */
  private async checkForAppointmentIntent(userMessage: string, botResponse: string): Promise<any> {
    try {
      // Primeiro, vamos usar a OpenAI para verificar se há intenção de agendamento
      const prompt = `
Analise a conversa abaixo e determine se o usuário está tentando agendar um compromisso ou consulta.
Extraia as informações relevantes para o agendamento.

Mensagem do usuário: "${userMessage}"
Resposta do assistente: "${botResponse}"

Responda em formato JSON com os seguintes campos:
- isAppointmentIntent: boolean (se o usuário está tentando agendar algo)
- service: string (qual serviço está sendo agendado, se identificado)
- date: string (data solicitada no formato YYYY-MM-DD, se identificada)
- time: string (horário solicitado no formato HH:MM, se identificado)
- name: string (nome do cliente, se identificado)
- phone: string (telefone do cliente, se identificado)
- email: string (email do cliente, se identificado)
`;

      const response = await openAIService.analyzeSentiment(prompt);
      
      return response;
    } catch (error) {
      log(`Erro ao verificar intenção de agendamento: ${error}`, 'chatbot-service');
      // Em caso de erro, retornar que não há intenção de agendamento
      return { isAppointmentIntent: false };
    }
  }
  
  /**
   * Processa a intenção de agendamento
   */
  private async processAppointmentIntent(
    appointmentInfo: any,
    phoneNumber: string,
    name: string
  ): Promise<{ created: boolean, details?: any }> {
    try {
      if (!appointmentInfo.date || !appointmentInfo.time || !appointmentInfo.service) {
        return { created: false };
      }
      
      // Buscar contato
      const contact = await storage.getContactByPhone(phoneNumber);
      
      if (!contact) {
        return { created: false };
      }
      
      // Criar objeto de data para o agendamento
      const appointmentDate = new Date(`${appointmentInfo.date}T${appointmentInfo.time}`);
      const appointmentEndDate = new Date(appointmentDate);
      appointmentEndDate.setHours(appointmentEndDate.getHours() + 1); // Duração padrão de 1 hora
      
      // Verificar disponibilidade
      const isAvailable = await googleCalendarService.checkAvailability(
        appointmentDate,
        appointmentEndDate
      );
      
      if (!isAvailable) {
        return { created: false };
      }
      
      // Criar evento no Google Calendar
      const googleEventId = await googleCalendarService.createAppointment({
        summary: `Agendamento: ${appointmentInfo.service} - ${name}`,
        description: `Agendamento feito via chatbot WhatsApp.\nNome: ${name}\nTelefone: ${phoneNumber}`,
        startTime: appointmentDate,
        endTime: appointmentEndDate,
        attendeeName: name,
        attendeePhone: phoneNumber,
        attendeeEmail: contact.email || undefined
      });
      
      if (!googleEventId) {
        return { created: false };
      }
      
      // Criar agendamento no banco de dados
      const appointment = await storage.createAppointment({
        contactId: contact.id,
        title: appointmentInfo.service,
        description: `Agendamento feito via chatbot WhatsApp`,
        startTime: appointmentDate,
        endTime: appointmentEndDate,
        googleEventId,
        status: 'confirmed',
        createdAt: new Date()
      });
      
      // Formato de data para exibição
      const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const formattedDate = dateFormatter.format(appointmentDate);
      const formattedTime = timeFormatter.format(appointmentDate);
      
      return {
        created: true,
        details: {
          service: appointmentInfo.service,
          date: formattedDate,
          time: formattedTime,
          googleEventId
        }
      };
    } catch (error) {
      log(`Erro ao processar agendamento: ${error}`, 'chatbot-service');
      return { created: false };
    }
  }
  
  /**
   * Atualiza o prompt completo do sistema
   */
  setFullPrompt(prompt: string): void {
    this.fullPrompt = prompt || this.defaultSystemPrompt;
  }
  
  /**
   * Retorna o prompt atual do sistema
   */
  getFullPrompt(): string {
    return this.fullPrompt;
  }
}

export const chatbotService = new ChatbotService();