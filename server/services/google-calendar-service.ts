import { google, calendar_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

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
  private calendar: calendar_v3.Calendar | null = null;
  private initialized: boolean = false;
  private calendarId: string | null = null;

  /**
   * Inicializa o serviço do Google Calendar
   * Requer as credenciais do Google Service Account em variáveis de ambiente:
   * - GOOGLE_CLIENT_EMAIL
   * - GOOGLE_PRIVATE_KEY
   * - GOOGLE_CALENDAR_ID
   */
  async initialize(): Promise<boolean> {
    try {
      // Verificar se as variáveis de ambiente necessárias estão definidas
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      this.calendarId = process.env.GOOGLE_CALENDAR_ID;

      if (!clientEmail || !privateKey || !this.calendarId) {
        console.error('Credenciais do Google não configuradas corretamente nas variáveis de ambiente');
        return false;
      }

      // Criar cliente JWT para autenticação
      const jwtClient = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      // Inicializar o cliente Calendar
      this.calendar = google.calendar({ version: 'v3', auth: jwtClient });
      
      // Verificar se o calendário existe
      await this.calendar.calendars.get({
        calendarId: this.calendarId
      });

      this.initialized = true;
      console.log('Serviço do Google Calendar inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar serviço do Google Calendar:', error);
      return false;
    }
  }

  /**
   * Verifica a disponibilidade de horário para agendamento
   * @param startTime Data e hora de início
   * @param endTime Data e hora de término
   * @returns true se o horário estiver disponível, false caso contrário
   */
  async checkAvailability(startTime: Date, endTime: Date): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.calendar || !this.calendarId) {
      console.error('Serviço do Google Calendar não inicializado');
      return false;
    }

    try {
      // Buscar eventos no período especificado
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      // Se não houver eventos no período, o horário está disponível
      return (response.data.items || []).length === 0;
    } catch (error) {
      console.error('Erro ao verificar disponibilidade no Google Calendar:', error);
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
      await this.initialize();
    }

    if (!this.calendar || !this.calendarId) {
      console.error('Serviço do Google Calendar não inicializado');
      return null;
    }

    try {
      // Construir o evento
      const event: calendar_v3.Schema$Event = {
        summary: appointment.summary,
        description: appointment.description,
        location: appointment.location,
        start: {
          dateTime: appointment.startTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: appointment.endTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
      };

      // Adicionar atendente se tiver email
      if (appointment.attendeeEmail) {
        event.attendees = [
          {
            email: appointment.attendeeEmail,
            displayName: appointment.attendeeName,
            comment: appointment.attendeePhone ? `Telefone: ${appointment.attendeePhone}` : undefined
          }
        ];
      }

      // Criar o evento
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
        sendNotifications: true,
      });

      return response.data.id || null;
    } catch (error) {
      console.error('Erro ao criar evento no Google Calendar:', error);
      return null;
    }
  }

  /**
   * Atualiza um evento existente
   * @param eventId ID do evento a ser atualizado
   * @param updatedData Dados atualizados do agendamento
   * @returns true se atualizado com sucesso, false caso contrário
   */
  async updateAppointment(eventId: string, updatedData: Partial<AppointmentData>): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.calendar || !this.calendarId) {
      console.error('Serviço do Google Calendar não inicializado');
      return false;
    }

    try {
      // Buscar o evento existente
      const existingEvent = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId,
      });

      if (!existingEvent.data) {
        console.error(`Evento com ID ${eventId} não encontrado`);
        return false;
      }

      // Atualizar os campos
      const updatedEvent: calendar_v3.Schema$Event = { ...existingEvent.data };

      if (updatedData.summary) {
        updatedEvent.summary = updatedData.summary;
      }

      if (updatedData.description) {
        updatedEvent.description = updatedData.description;
      }

      if (updatedData.location) {
        updatedEvent.location = updatedData.location;
      }

      if (updatedData.startTime) {
        updatedEvent.start = {
          dateTime: updatedData.startTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        };
      }

      if (updatedData.endTime) {
        updatedEvent.end = {
          dateTime: updatedData.endTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        };
      }

      if (updatedData.attendeeEmail) {
        updatedEvent.attendees = [
          {
            email: updatedData.attendeeEmail,
            displayName: updatedData.attendeeName,
            comment: updatedData.attendeePhone ? `Telefone: ${updatedData.attendeePhone}` : undefined
          }
        ];
      }

      // Enviar atualização
      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventId,
        requestBody: updatedEvent,
        sendNotifications: true,
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar evento no Google Calendar:', error);
      return false;
    }
  }

  /**
   * Cancela um agendamento existente
   * @param eventId ID do evento a ser cancelado
   * @returns true se cancelado com sucesso, false caso contrário
   */
  async cancelAppointment(eventId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.calendar || !this.calendarId) {
      console.error('Serviço do Google Calendar não inicializado');
      return false;
    }

    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId,
        sendNotifications: true,
      });

      return true;
    } catch (error) {
      console.error('Erro ao cancelar evento no Google Calendar:', error);
      return false;
    }
  }

  /**
   * Obtém a lista de agendamentos para um determinado período
   * @param startDate Data de início
   * @param endDate Data de término
   * @returns Lista de eventos no período ou array vazio em caso de erro
   */
  async getAppointments(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.calendar || !this.calendarId) {
      console.error('Serviço do Google Calendar não inicializado');
      return [];
    }

    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Erro ao buscar eventos no Google Calendar:', error);
      return [];
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();