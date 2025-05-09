import { storage } from '../storage';
import { openAIService, ChatMessage } from './openai-service';
import { googleSheetsService } from './google-sheets-service';
import { googleCalendarService } from './google-calendar-service';
import { InsertChatbotSession, InsertContact, InsertAppointment } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

interface ChatbotRequest {
  message: string;
  phoneNumber: string;
  name?: string;
}

interface ChatbotResponse {
  message: string;
  appointmentCreated?: boolean;
  appointmentDetails?: {
    id: number;
    date: string;
    time: string;
    service: string;
  };
  contactUpdated?: boolean;
}

class ChatbotService {
  /**
   * Processa uma mensagem do usuário e retorna uma resposta do chatbot
   * @param request Requisição contendo mensagem e informações de contato
   * @returns Resposta do chatbot
   */
  async processMessage(request: ChatbotRequest): Promise<ChatbotResponse> {
    try {
      // Buscar ou criar sessão para o usuário
      const session = await this.getOrCreateSession(request.phoneNumber, request.name);
      
      // Buscar histórico de conversa
      const conversationHistory = this.parseConversationHistory(session.conversationHistory);
      
      // Adicionar mensagem do usuário ao histórico
      conversationHistory.push({
        role: 'user',
        content: request.message
      });
      
      // Gerar resposta do chatbot usando a OpenAI
      const botResponse = await openAIService.generateChatResponse(conversationHistory);
      
      // Adicionar resposta do bot ao histórico
      conversationHistory.push({
        role: 'assistant',
        content: botResponse
      });
      
      // Extrair informações estruturadas da conversa
      const structuredInfo = await openAIService.extractStructuredInformation(conversationHistory);
      
      // Atualizar sessão com histórico atualizado
      await storage.updateChatbotSession(session.id, {
        conversationHistory: JSON.stringify(conversationHistory),
        lastMessage: new Date()
      });
      
      // Processar dados extraídos
      const processedResponse: ChatbotResponse = {
        message: botResponse
      };
      
      // Atualizar informações de contato se necessário
      if (structuredInfo.name || structuredInfo.email) {
        await this.updateContactInfo(request.phoneNumber, structuredInfo);
        processedResponse.contactUpdated = true;
      }
      
      // Criar agendamento se necessário
      if (structuredInfo.hasPendingAppointment && structuredInfo.appointment) {
        const appointmentResult = await this.createAppointment(
          request.phoneNumber,
          structuredInfo
        );
        
        if (appointmentResult) {
          processedResponse.appointmentCreated = true;
          processedResponse.appointmentDetails = appointmentResult;
        }
      }
      
      return processedResponse;
    } catch (error) {
      console.error('Erro ao processar mensagem do chatbot:', error);
      return {
        message: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.'
      };
    }
  }

  /**
   * Busca ou cria uma sessão de chatbot para o usuário
   * @param phoneNumber Número de telefone do usuário
   * @param name Nome do usuário (opcional)
   * @returns Sessão de chatbot
   */
  private async getOrCreateSession(phoneNumber: string, name?: string): Promise<any> {
    try {
      // Buscar contato pelo número de telefone
      let contact = await storage.getContactByPhone(phoneNumber);
      
      // Se não existir contato, criar um novo
      if (!contact) {
        const insertContact: InsertContact = {
          name: name || phoneNumber,
          phoneNumber,
          isGroup: false,
          memberCount: null,
          email: null,
          notes: null
        };
        
        contact = await storage.createContact(insertContact);
        
        // Adicionar ao Google Sheets se configurado
        try {
          await googleSheetsService.addContact({
            name: contact.name,
            phoneNumber: contact.phoneNumber,
            createdAt: new Date()
          });
        } catch (error) {
          console.error('Erro ao adicionar contato ao Google Sheets:', error);
        }
      }
      
      // Buscar sessões ativas do contato
      const sessions = await storage.getChatbotSessionsByContactId(contact.id);
      
      // Filtrar sessões ativas (últimas 24 horas)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const activeSessions = sessions.filter(s => 
        new Date(s.lastMessage) > oneDayAgo
      );
      
      // Se tiver sessão ativa, retornar a mais recente
      if (activeSessions.length > 0) {
        return activeSessions[0];
      }
      
      // Se não tiver sessão ativa, criar uma nova
      const sessionId = uuidv4();
      const insertSession: InsertChatbotSession = {
        contactId: contact.id,
        sessionId,
        conversationHistory: JSON.stringify([])
      };
      
      return await storage.createChatbotSession(insertSession);
    } catch (error) {
      console.error('Erro ao buscar/criar sessão de chatbot:', error);
      throw error;
    }
  }
  
  /**
   * Converte o histórico de conversa de string para array de mensagens
   * @param historyString String JSON do histórico
   * @returns Array de mensagens
   */
  private parseConversationHistory(historyString: string): ChatMessage[] {
    try {
      return JSON.parse(historyString) as ChatMessage[];
    } catch (error) {
      console.error('Erro ao parsear histórico de conversa:', error);
      return [];
    }
  }
  
  /**
   * Atualiza informações de contato com base nos dados extraídos
   * @param phoneNumber Número de telefone do contato
   * @param info Informações extraídas
   */
  private async updateContactInfo(phoneNumber: string, info: any): Promise<void> {
    try {
      const contact = await storage.getContactByPhone(phoneNumber);
      if (!contact) return;
      
      // Dados a serem atualizados
      const updateData: Partial<InsertContact> = {};
      let updated = false;
      
      if (info.name && info.name !== contact.name) {
        updateData.name = info.name;
        updated = true;
      }
      
      if (info.email && info.email !== contact.email) {
        updateData.email = info.email;
        updated = true;
      }
      
      // Consolidar informações nas notas
      let notes = contact.notes || '';
      
      // Adicionar informações de interesses
      if (info.interests && info.interests.length > 0) {
        if (!notes.includes('Interesses:')) {
          notes += `\nInteresses: ${info.interests.join(', ')}\n`;
          updated = true;
        }
      }
      
      if (updated) {
        updateData.notes = notes;
        await storage.updateContact(contact.id, updateData);
        
        // Atualizar no Google Sheets se configurado
        try {
          await googleSheetsService.updateContactNotes(phoneNumber, notes);
        } catch (error) {
          console.error('Erro ao atualizar contato no Google Sheets:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar informações de contato:', error);
      throw error;
    }
  }
  
  /**
   * Cria um agendamento com base nas informações extraídas
   * @param phoneNumber Número de telefone do contato
   * @param info Informações extraídas
   * @returns Detalhes do agendamento criado ou null em caso de erro
   */
  private async createAppointment(phoneNumber: string, info: any): Promise<any | null> {
    try {
      if (!info.appointment || !info.appointment.date || !info.appointment.time) {
        return null;
      }
      
      const contact = await storage.getContactByPhone(phoneNumber);
      if (!contact) return null;
      
      // Converter string de data e hora para objeto Date
      const dateStr = info.appointment.date;
      const timeStr = info.appointment.time;
      
      // Parsear a data (formato DD/MM/YYYY)
      const [day, month, year] = dateStr.split('/').map(Number);
      
      // Parsear a hora (formato HH:MM)
      const [hour, minute] = timeStr.split(':').map(Number);
      
      const startTime = new Date(year, month - 1, day, hour, minute);
      
      // Definir hora de término (1 hora depois)
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);
      
      // Verificar disponibilidade no Google Calendar
      let googleEventId: string | null = null;
      
      try {
        const isAvailable = await googleCalendarService.checkAvailability(startTime, endTime);
        
        if (isAvailable) {
          googleEventId = await googleCalendarService.createAppointment({
            summary: `Agendamento: ${contact.name}`,
            description: `Serviço: ${info.appointment.service || 'Não especificado'}\nTelefone: ${phoneNumber}`,
            startTime,
            endTime,
            attendeeEmail: info.email,
            attendeeName: contact.name,
            attendeePhone: phoneNumber
          });
        } else {
          // Se não estiver disponível, retornar erro
          return null;
        }
      } catch (error) {
        console.error('Erro ao verificar disponibilidade ou criar evento no Google Calendar:', error);
      }
      
      // Criar agendamento no banco de dados
      const insertAppointment: InsertAppointment = {
        contactId: contact.id,
        title: info.appointment.service || 'Consulta',
        description: `Agendamento via chatbot para ${contact.name}`,
        startTime,
        endTime,
        googleEventId: googleEventId || undefined,
        status: 'scheduled'
      };
      
      const appointment = await storage.createAppointment(insertAppointment);
      
      return {
        id: appointment.id,
        date: dateStr,
        time: timeStr,
        service: info.appointment.service || 'Consulta'
      };
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      return null;
    }
  }
}

export const chatbotService = new ChatbotService();