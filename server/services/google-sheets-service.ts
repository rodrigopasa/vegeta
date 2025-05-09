import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

interface ContactData {
  name: string;
  phoneNumber: string;
  email?: string;
  notes?: string;
  createdAt: Date;
}

class GoogleSheetsService {
  private sheets: sheets_v4.Sheets | null = null;
  private initialized: boolean = false;
  private spreadsheetId: string | null = null;

  /**
   * Inicializa o serviço do Google Sheets
   * Requer as credenciais do Google Service Account em variáveis de ambiente:
   * - GOOGLE_CLIENT_EMAIL
   * - GOOGLE_PRIVATE_KEY
   * - GOOGLE_SHEET_ID
   */
  async initialize(): Promise<boolean> {
    try {
      // Verificar se as variáveis de ambiente necessárias estão definidas
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      this.spreadsheetId = process.env.GOOGLE_SHEET_ID;

      if (!clientEmail || !privateKey || !this.spreadsheetId) {
        console.error('Credenciais do Google não configuradas corretamente nas variáveis de ambiente');
        return false;
      }

      // Criar cliente JWT para autenticação
      const jwtClient = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      // Inicializar o cliente Sheets
      this.sheets = google.sheets({ version: 'v4', auth: jwtClient });
      
      // Verificar se a planilha existe
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      // Verificar se a aba de contatos existe, se não, criar
      await this.ensureContactsSheetExists();

      this.initialized = true;
      console.log('Serviço do Google Sheets inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar serviço do Google Sheets:', error);
      return false;
    }
  }

  /**
   * Garante que a aba de contatos exista na planilha
   */
  private async ensureContactsSheetExists(): Promise<void> {
    if (!this.sheets || !this.spreadsheetId) return;

    try {
      // Verificar se a planilha já tem a aba de contatos
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const sheets = response.data.sheets || [];
      const contactsSheetExists = sheets.some(sheet => 
        sheet.properties?.title === 'Contatos'
      );

      if (!contactsSheetExists) {
        // Adicionar nova aba para contatos
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Contatos',
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 10
                    }
                  }
                }
              }
            ]
          }
        });

        // Adicionar cabeçalhos
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Contatos!A1:F1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Nome', 'Telefone', 'Email', 'Observações', 'Data de Cadastro', 'ID']]
          }
        });
      }
    } catch (error) {
      console.error('Erro ao verificar ou criar aba de contatos:', error);
      throw error;
    }
  }

  /**
   * Adiciona um novo contato na planilha do Google Sheets
   * @param contact Dados do contato a ser adicionado
   * @returns ID do contato na planilha ou null em caso de erro
   */
  async addContact(contact: ContactData): Promise<number | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.sheets || !this.spreadsheetId) {
      console.error('Serviço do Google Sheets não inicializado');
      return null;
    }

    try {
      // Gerar um ID único para o contato
      const contactId = Date.now();
      
      // Formatar a data para o formato brasileiro
      const formattedDate = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(contact.createdAt);

      // Adicionar o contato na próxima linha disponível
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Contatos!A:F',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[
            contact.name,
            contact.phoneNumber,
            contact.email || '',
            contact.notes || '',
            formattedDate,
            contactId.toString()
          ]]
        }
      });

      return contactId;
    } catch (error) {
      console.error('Erro ao adicionar contato ao Google Sheets:', error);
      return null;
    }
  }

  /**
   * Busca um contato pelo número de telefone
   * @param phoneNumber Número de telefone a ser buscado
   * @returns Dados do contato ou null se não encontrado
   */
  async findContactByPhone(phoneNumber: string): Promise<ContactData | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.sheets || !this.spreadsheetId) {
      console.error('Serviço do Google Sheets não inicializado');
      return null;
    }

    try {
      // Buscar todos os dados da planilha
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Contatos!A:F',
      });

      const rows = response.data.values || [];
      
      // Pular a primeira linha (cabeçalhos)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Verificar se o telefone corresponde
        if (row[1] === phoneNumber) {
          return {
            name: row[0],
            phoneNumber: row[1],
            email: row[2] || undefined,
            notes: row[3] || undefined,
            createdAt: new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar contato no Google Sheets:', error);
      return null;
    }
  }

  /**
   * Atualiza as observações de um contato existente
   * @param phoneNumber Número de telefone do contato
   * @param notes Novas observações
   * @returns true se atualizado com sucesso, false caso contrário
   */
  async updateContactNotes(phoneNumber: string, notes: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.sheets || !this.spreadsheetId) {
      console.error('Serviço do Google Sheets não inicializado');
      return false;
    }

    try {
      // Buscar todos os dados da planilha
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Contatos!A:F',
      });

      const rows = response.data.values || [];
      
      // Encontrar a linha do contato
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][1] === phoneNumber) {
          rowIndex = i;
          break;
        }
      }

      if (rowIndex === -1) {
        console.error(`Contato com telefone ${phoneNumber} não encontrado`);
        return false;
      }

      // Atualizar as observações
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Contatos!D${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[notes]]
        }
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar observações do contato:', error);
      return false;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();