import { google } from 'googleapis';
import { log } from '../vite';

// Interface para dados de contato
interface Contact {
  name: string;
  phoneNumber: string;
  email: string | null;
  notes?: string | null;
  createdAt: Date;
}

class GoogleSheetsService {
  private sheets: any = null;
  private initialized: boolean = false;
  private spreadsheetId: string | null = null;
  private sheetName: string = 'Contatos';
  
  // Configurações das planilhas
  private sheets_config = {
    contacts_sheet: {
      name: 'Contatos',
      headers: ['ID', 'Nome', 'Telefone', 'Email', 'Notas', 'Data Criação']
    },
    appointments_sheet: {
      name: 'Agendamentos',
      headers: ['ID', 'Nome Cliente', 'Telefone', 'Serviço', 'Data', 'Horário', 'Status', 'Notas', 'Data Criação']
    }
  };
  
  /**
   * Define o ID da planilha a ser usada
   * @param id ID da planilha do Google Sheets
   */
  setSpreadsheetId(id: string): void {
    this.spreadsheetId = id;
    // Resetar estado de inicialização para forçar nova conexão
    this.initialized = false;
  }
  
  /**
   * Define o nome da aba para contatos
   * @param name Nome da aba
   */
  setSheetName(name: string): void {
    this.sheetName = name;
    this.sheets_config.contacts_sheet.name = name;
  }
  
  /**
   * Testa a conexão com o Google Sheets
   * @returns true se a conexão estiver funcionando
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Tenta obter informações sobre a planilha para verificar se a conexão funciona
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      return true;
    } catch (error) {
      log(`Erro ao testar conexão com Google Sheets: ${error}`, "google-sheets");
      throw error;
    }
  }
  
  /**
   * Inicializa a conexão com a API do Google Sheets
   */
  async initialize(): Promise<boolean> {
    try {
      // Verificar se as credenciais estão definidas
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
      
      if (!clientEmail || !privateKey || !this.spreadsheetId) {
        log("Credenciais do Google Sheets não estão configuradas", "google-sheets");
        return false;
      }
      
      // Criar cliente de autenticação
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      
      // Inicializar cliente do Sheets
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      
      // Verificar se as planilhas necessárias existem e criá-las se não existirem
      await this.ensureSheetsExist();
      
      log("Google Sheets inicializado com sucesso", "google-sheets");
      return true;
    } catch (error) {
      log(`Erro ao inicializar Google Sheets: ${error}`, "google-sheets");
      return false;
    }
  }
  
  /**
   * Garante que as planilhas necessárias existam
   */
  private async ensureSheetsExist(): Promise<void> {
    if (!this.initialized || !this.sheets || !this.spreadsheetId) {
      throw new Error("Serviço Google Sheets não inicializado");
    }
    
    try {
      // Obter informações sobre a planilha
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      const sheets = response.data.sheets;
      const sheetNames = sheets.map((sheet: any) => sheet.properties.title);
      
      // Verificar cada planilha configurada
      for (const [_, config] of Object.entries(this.sheets_config)) {
        const sheetName = config.name;
        
        // Se a planilha não existir, criar
        if (!sheetNames.includes(sheetName)) {
          await this.createSheet(sheetName, config.headers);
        }
      }
    } catch (error) {
      log(`Erro ao verificar planilhas: ${error}`, "google-sheets");
      throw error;
    }
  }
  
  /**
   * Cria uma nova aba na planilha com os cabeçalhos especificados
   */
  private async createSheet(sheetName: string, headers: string[]): Promise<void> {
    if (!this.initialized || !this.sheets || !this.spreadsheetId) {
      throw new Error("Serviço Google Sheets não inicializado");
    }
    
    try {
      // Adicionar nova aba
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }
          ]
        }
      });
      
      // Adicionar cabeçalhos
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:${this.columnToLetter(headers.length)}1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      });
      
      log(`Planilha '${sheetName}' criada com sucesso`, "google-sheets");
    } catch (error) {
      log(`Erro ao criar planilha '${sheetName}': ${error}`, "google-sheets");
      throw error;
    }
  }
  
  /**
   * Adiciona um contato à planilha de Contatos
   */
  async addContact(contact: Contact): Promise<string> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Sheets não inicializado");
      }
    }
    
    try {
      // Gerar ID único para o contato (timestamp)
      const contactId = Date.now().toString();
      
      // Formatar data de criação
      const formattedDate = contact.createdAt.toLocaleString('pt-BR');
      
      // Preparar dados para inserção
      const values = [
        contactId,
        contact.name,
        contact.phoneNumber,
        contact.email || '',
        contact.notes || '',
        formattedDate
      ];
      
      // Adicionar linha à planilha
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheets_config.contacts_sheet.name}!A:F`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [values]
        }
      });
      
      log(`Contato '${contact.name}' adicionado ao Google Sheets`, "google-sheets");
      return contactId;
    } catch (error) {
      log(`Erro ao adicionar contato ao Google Sheets: ${error}`, "google-sheets");
      throw error;
    }
  }
  
  /**
   * Adiciona um agendamento à planilha de Agendamentos
   */
  async addAppointment(data: {
    name: string;
    phone: string;
    service: string;
    date: Date;
    status: string;
    notes?: string;
  }): Promise<string> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Serviço Google Sheets não inicializado");
      }
    }
    
    try {
      // Gerar ID único para o agendamento (timestamp)
      const appointmentId = Date.now().toString();
      
      // Formatar data do agendamento
      const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const formattedDate = dateFormatter.format(data.date);
      const formattedTime = timeFormatter.format(data.date);
      const formattedCreatedAt = new Date().toLocaleString('pt-BR');
      
      // Preparar dados para inserção
      const values = [
        appointmentId,
        data.name,
        data.phone,
        data.service,
        formattedDate,
        formattedTime,
        data.status,
        data.notes || '',
        formattedCreatedAt
      ];
      
      // Adicionar linha à planilha
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheets_config.appointments_sheet.name}!A:I`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [values]
        }
      });
      
      log(`Agendamento para '${data.name}' adicionado ao Google Sheets`, "google-sheets");
      return appointmentId;
    } catch (error) {
      log(`Erro ao adicionar agendamento ao Google Sheets: ${error}`, "google-sheets");
      throw error;
    }
  }
  
  /**
   * Converte número de coluna para letra (ex: 1 = A, 2 = B, etc.)
   */
  private columnToLetter(column: number): string {
    let temp, letter = '';
    while (column > 0) {
      temp = (column - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      column = (column - temp - 1) / 26;
    }
    return letter;
  }
}

export const googleSheetsService = new GoogleSheetsService();