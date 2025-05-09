import { google } from 'googleapis';
import { log } from '../vite';

interface AppointmentData {
  summary: string;
  description: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail?: string;
  attendeeName?: string;
  attendeePhone?: string;
}

class GoogleCalendarService {
  private calendar: any = null;
  private initialized: boolean = false;
  private calendarId: string | null = null;
  
  /**
   * Define o ID do calendário a ser usado
   * @param id ID do calendário
   */
  setCalendarId(id: string): void {
    this.calendarId = id;
    // Resetar estado de inicialização para forçar nova conexão
    this.initialized = false;
  }
  
  /**
   * Obtém o ID do calendário atual
   * @returns ID do calendário
   */
  getCalendarId(): string | null {
    return this.calendarId;
  }
  
  /**
   * Lista os eventos do calendário
   * @param maxResults Número máximo de resultados a retornar
   * @returns Lista de eventos
   */
  async listEvents(maxResults: number = 10): Promise<any[]> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Calendar não inicializado");
      }
    }
    
    try {
      const now = new Date();
      const twoWeeksLater = new Date();
      twoWeeksLater.setDate(now.getDate() + 14);
      
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: now.toISOString(),
        timeMax: twoWeeksLater.toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      return response.data.items || [];
    } catch (error) {
      log(`Erro ao listar eventos no Google Calendar: ${error}`, "google-calendar");
      return [];
    }
  }
  
  /**
   * Inicializa a conexão com a API do Google Calendar
   */
  async initialize(): Promise<boolean> {
    try {
      // Verificar se as credenciais estão definidas
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      this.calendarId = process.env.GOOGLE_CALENDAR_ID;
      
      if (!clientEmail || !privateKey || !this.calendarId) {
        log("Credenciais do Google Calendar não estão configuradas", "google-calendar");
        return false;
      }
      
      // Criar cliente de autenticação
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      
      // Inicializar cliente do Calendar
      this.calendar = google.calendar({ version: 'v3', auth });
      this.initialized = true;
      
      log("Google Calendar inicializado com sucesso", "google-calendar");
      return true;
    } catch (error) {
      log(`Erro ao inicializar Google Calendar: ${error}`, "google-calendar");
      return false;
    }
  }
  
  /**
   * Verifica se um horário está disponível para agendamento
   * @param startTime Horário de início
   * @param endTime Horário de término
   * @returns true se o horário estiver disponível, false caso contrário
   */
  async checkAvailability(startTime: Date, endTime: Date): Promise<boolean> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Calendar não inicializado");
      }
    }
    
    try {
      // Buscar eventos no intervalo de tempo
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const events = response.data.items;
      
      // Se não houver eventos, o horário está disponível
      if (!events || events.length === 0) {
        return true;
      }
      
      // Verificar se algum evento conflita com o horário solicitado
      // Um evento conflita se seu horário de início for menor que o horário de término solicitado
      // e seu horário de término for maior que o horário de início solicitado
      for (const event of events) {
        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);
        
        // Verificar se há sobreposição
        if (eventStart < endTime && eventEnd > startTime) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      log(`Erro ao verificar disponibilidade: ${error}`, "google-calendar");
      // Em caso de erro, assumir que o horário não está disponível por segurança
      return false;
    }
  }
  
  /**
   * Cria um novo evento de agendamento no Google Calendar
   * @param appointment Dados do agendamento
   * @returns ID do evento criado ou null em caso de erro
   */
  async createAppointment(appointment: AppointmentData): Promise<string | null> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Calendar não inicializado");
      }
    }
    
    try {
      // Preparar evento para criação
      const event: any = {
        summary: appointment.summary,
        location: appointment.location || 'Local não especificado',
        description: appointment.description,
        start: {
          dateTime: appointment.startTime.toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        end: {
          dateTime: appointment.endTime.toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        // Campo personalizado para armazenar o telefone de contato
        extendedProperties: {
          private: {
            phone: appointment.attendeePhone || 'Não informado'
          }
        }
      };
      
      // Adicionar participantes, se informados
      if (appointment.attendeeEmail) {
        event.attendees = [
          {
            email: appointment.attendeeEmail,
            displayName: appointment.attendeeName || 'Cliente',
            responseStatus: 'accepted'
          }
        ];
      }
      
      // Criar evento
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: event
      });
      
      const eventId = response.data.id;
      log(`Evento criado no Google Calendar: ${eventId}`, "google-calendar");
      
      return eventId;
    } catch (error) {
      log(`Erro ao criar evento no Google Calendar: ${error}`, "google-calendar");
      return null;
    }
  }
  
  /**
   * Obtém detalhes de um evento pelo ID
   * @param eventId ID do evento
   * @returns Detalhes do evento ou null se não encontrado
   */
  async getAppointment(eventId: string): Promise<any | null> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Calendar não inicializado");
      }
    }
    
    try {
      const response = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId
      });
      
      return response.data;
    } catch (error) {
      log(`Erro ao buscar evento ${eventId} no Google Calendar: ${error}`, "google-calendar");
      return null;
    }
  }
  
  /**
   * Atualiza um evento existente
   * @param eventId ID do evento
   * @param updateData Dados a serem atualizados
   * @returns true se a atualização foi bem-sucedida, false caso contrário
   */
  async updateAppointment(eventId: string, updateData: Partial<AppointmentData>): Promise<boolean> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Calendar não inicializado");
      }
    }
    
    try {
      // Obter evento atual
      const currentEvent = await this.getAppointment(eventId);
      if (!currentEvent) {
        throw new Error(`Evento ${eventId} não encontrado`);
      }
      
      // Preparar dados para atualização
      const event: any = {
        summary: updateData.summary !== undefined ? updateData.summary : currentEvent.summary,
        location: updateData.location !== undefined ? updateData.location : currentEvent.location,
        description: updateData.description !== undefined ? updateData.description : currentEvent.description
      };
      
      // Atualizar horários, se informados
      if (updateData.startTime) {
        event.start = {
          dateTime: updateData.startTime.toISOString(),
          timeZone: 'America/Sao_Paulo'
        };
      }
      
      if (updateData.endTime) {
        event.end = {
          dateTime: updateData.endTime.toISOString(),
          timeZone: 'America/Sao_Paulo'
        };
      }
      
      // Atualizar propriedades estendidas
      if (updateData.attendeePhone) {
        event.extendedProperties = {
          private: {
            phone: updateData.attendeePhone
          }
        };
      }
      
      // Atualizar evento
      await this.calendar.events.patch({
        calendarId: this.calendarId,
        eventId: eventId,
        resource: event
      });
      
      log(`Evento ${eventId} atualizado no Google Calendar`, "google-calendar");
      return true;
    } catch (error) {
      log(`Erro ao atualizar evento ${eventId} no Google Calendar: ${error}`, "google-calendar");
      return false;
    }
  }
  
  /**
   * Cancela (exclui) um evento
   * @param eventId ID do evento
   * @returns true se o cancelamento foi bem-sucedido, false caso contrário
   */
  async cancelAppointment(eventId: string): Promise<boolean> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Calendar não inicializado");
      }
    }
    
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId
      });
      
      log(`Evento ${eventId} cancelado no Google Calendar`, "google-calendar");
      return true;
    } catch (error) {
      log(`Erro ao cancelar evento ${eventId} no Google Calendar: ${error}`, "google-calendar");
      return false;
    }
  }
  
  /**
   * Lista eventos em um intervalo de datas
   * @param startDate Data de início
   * @param endDate Data de término
   * @returns Lista de eventos
   */
  async listAppointments(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Calendar não inicializado");
      }
    }
    
    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      return response.data.items || [];
    } catch (error) {
      log(`Erro ao listar eventos no Google Calendar: ${error}`, "google-calendar");
      return [];
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();