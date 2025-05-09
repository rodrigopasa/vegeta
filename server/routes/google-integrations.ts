import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { googleCalendarService } from '../services/google-calendar-service';
import { googleSheetsService } from '../services/google-sheets-service';

// Caminho para os arquivos de configuração
const CONFIG_DIR = path.join(process.cwd(), 'config');
const CALENDAR_CONFIG_PATH = path.join(CONFIG_DIR, 'calendar-config.json');
const SHEETS_CONFIG_PATH = path.join(CONFIG_DIR, 'sheets-config.json');

// Verifica se o diretório de configuração existe
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Funções para gerenciar a configuração do Google Calendar
export async function getCalendarConfig(req: Request, res: Response) {
  try {
    if (fs.existsSync(CALENDAR_CONFIG_PATH)) {
      const configData = fs.readFileSync(CALENDAR_CONFIG_PATH, 'utf8');
      const config = JSON.parse(configData);
      res.json(config);
    } else {
      // Se não existir configuração, retorna um objeto vazio
      res.json({});
    }
  } catch (error) {
    console.error('Erro ao obter configuração do Calendar:', error);
    res.status(500).json({ error: 'Falha ao obter configuração do Google Calendar' });
  }
}

export async function initializeCalendar(req: Request, res: Response) {
  try {
    const { calendarId } = req.body;
    
    if (!calendarId) {
      return res.status(400).json({ error: 'ID do calendário é obrigatório' });
    }
    
    // Salva a configuração
    const config = { calendarId };
    fs.writeFileSync(CALENDAR_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    
    // Testa a conexão com o Google Calendar
    const events = await googleCalendarService.listEvents();
    
    res.json({ 
      success: true, 
      message: 'Calendário configurado com sucesso',
      config,
      events: events.slice(0, 5) // Retorna os 5 primeiros eventos para mostrar que está funcionando
    });
  } catch (error) {
    console.error('Erro ao inicializar Calendar:', error);
    res.status(500).json({ error: 'Falha ao configurar o Google Calendar', details: error.message });
  }
}

// Funções para gerenciar a configuração do Google Sheets
export async function getSheetsConfig(req: Request, res: Response) {
  try {
    if (fs.existsSync(SHEETS_CONFIG_PATH)) {
      const configData = fs.readFileSync(SHEETS_CONFIG_PATH, 'utf8');
      const config = JSON.parse(configData);
      res.json(config);
    } else {
      // Se não existir configuração, retorna um objeto vazio
      res.json({});
    }
  } catch (error) {
    console.error('Erro ao obter configuração do Sheets:', error);
    res.status(500).json({ error: 'Falha ao obter configuração do Google Sheets' });
  }
}

export async function initializeSheets(req: Request, res: Response) {
  try {
    const { spreadsheetId, sheetName } = req.body;
    
    if (!spreadsheetId || !sheetName) {
      return res.status(400).json({ error: 'ID da planilha e nome da aba são obrigatórios' });
    }
    
    // Salva a configuração
    const config = { spreadsheetId, sheetName };
    fs.writeFileSync(SHEETS_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    
    // Configura o serviço do Google Sheets com o novo ID
    googleSheetsService.setSpreadsheetId(spreadsheetId);
    googleSheetsService.setSheetName(sheetName);
    
    // Testa a conexão com o Google Sheets
    await googleSheetsService.testConnection();
    
    res.json({ 
      success: true, 
      message: 'Planilha configurada com sucesso',
      config
    });
  } catch (error) {
    console.error('Erro ao inicializar Sheets:', error);
    res.status(500).json({ error: 'Falha ao configurar o Google Sheets', details: error.message });
  }
}