import { Request, Response } from 'express';
import { googleCalendarService } from '../services/google-calendar-service';
import { googleSheetsService } from '../services/google-sheets-service';

/**
 * Obtém a configuração atual do Google Calendar
 */
export async function getCalendarConfig(req: Request, res: Response) {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || null;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || null;
    
    // Verifica se as credenciais estão configuradas
    const hasCredentials = Boolean(clientEmail && process.env.GOOGLE_PRIVATE_KEY);
    
    // Obtém se o serviço está inicializado
    const isInitialized = googleCalendarService && googleCalendarService.getCalendarId() !== null;
    
    res.json({
      calendarId,
      hasCredentials,
      isInitialized
    });
    
  } catch (error) {
    console.error('Erro ao obter configuração do Google Calendar:', error);
    res.status(500).json({ 
      error: 'Erro ao obter configuração do Google Calendar', 
      details: (error as Error).message 
    });
  }
}

/**
 * Inicializa o serviço do Google Calendar com um ID de calendário personalizado
 */
export async function initializeCalendar(req: Request, res: Response) {
  try {
    const { calendarId } = req.body;
    
    if (!calendarId) {
      return res.status(400).json({ 
        error: 'ID do calendário é obrigatório'
      });
    }
    
    // Verifica se as credenciais do Google estão configuradas
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!clientEmail || !privateKey) {
      return res.status(400).json({ 
        error: 'Credenciais do Google não configuradas', 
        requiredCredentials: ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'] 
      });
    }
    
    console.log(`Inicializando Google Calendar com ID: ${calendarId}`);
    
    // Define o ID do calendário e inicializa o serviço
    googleCalendarService.setCalendarId(calendarId);
    const success = await googleCalendarService.initialize();
    
    if (success) {
      // Salvar o ID do calendário como variável de ambiente para persistência
      process.env.GOOGLE_CALENDAR_ID = calendarId;
      
      console.log(`Google Calendar inicializado com sucesso: ${calendarId}`);
      
      res.json({ 
        success: true, 
        message: 'Conexão com Google Calendar inicializada com sucesso',
        calendarId
      });
    } else {
      console.error(`Falha ao inicializar Google Calendar com ID: ${calendarId}`);
      
      res.status(500).json({ 
        error: 'Falha ao inicializar conexão com Google Calendar'
      });
    }
    
  } catch (error) {
    console.error('Erro ao inicializar Google Calendar:', error);
    res.status(500).json({ 
      error: 'Erro ao inicializar Google Calendar', 
      details: (error as Error).message 
    });
  }
}

/**
 * Obtém a configuração atual do Google Sheets
 */
export async function getSheetsConfig(req: Request, res: Response) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || null;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || null;
    
    // Verifica se as credenciais estão configuradas
    const hasCredentials = Boolean(clientEmail && process.env.GOOGLE_PRIVATE_KEY);
    
    // Obtém o estado de inicialização do serviço
    const isInitialized = googleSheetsService && googleSheetsService.spreadsheetId !== null;
    
    res.json({
      spreadsheetId,
      hasCredentials,
      isInitialized
    });
    
  } catch (error) {
    console.error('Erro ao obter configuração do Google Sheets:', error);
    res.status(500).json({ 
      error: 'Erro ao obter configuração do Google Sheets', 
      details: (error as Error).message 
    });
  }
}

/**
 * Inicializa o serviço do Google Sheets com um ID de planilha personalizado
 */
export async function initializeSheets(req: Request, res: Response) {
  try {
    const { spreadsheetId, sheetName } = req.body;
    
    if (!spreadsheetId) {
      return res.status(400).json({ 
        error: 'ID da planilha é obrigatório'
      });
    }
    
    // Verifica se as credenciais do Google estão configuradas
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!clientEmail || !privateKey) {
      return res.status(400).json({ 
        error: 'Credenciais do Google não configuradas', 
        requiredCredentials: ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'] 
      });
    }
    
    console.log(`Inicializando Google Sheets com ID: ${spreadsheetId}, Aba: ${sheetName || 'Contatos'}`);
    
    // Define o ID da planilha e inicializa o serviço
    googleSheetsService.setSpreadsheetId(spreadsheetId);
    
    // Se o nome da aba for fornecido, define-o também
    if (sheetName) {
      googleSheetsService.setSheetName(sheetName);
    }
    
    const success = await googleSheetsService.initialize();
    
    if (success) {
      // Salvar o ID da planilha como variável de ambiente para persistência
      process.env.GOOGLE_SHEET_ID = spreadsheetId;
      
      console.log(`Google Sheets inicializado com sucesso: ${spreadsheetId}`);
      
      res.json({ 
        success: true, 
        message: 'Conexão com Google Sheets inicializada com sucesso',
        spreadsheetId,
        sheetName: sheetName || 'Contatos'
      });
    } else {
      console.error(`Falha ao inicializar Google Sheets com ID: ${spreadsheetId}`);
      
      res.status(500).json({ 
        error: 'Falha ao inicializar conexão com Google Sheets'
      });
    }
    
  } catch (error) {
    console.error('Erro ao inicializar Google Sheets:', error);
    res.status(500).json({ 
      error: 'Erro ao inicializar Google Sheets', 
      details: (error as Error).message 
    });
  }
}