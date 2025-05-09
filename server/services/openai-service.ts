import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class OpenAIService {
  private defaultSystemPrompt = `Você é um assistente virtual de uma empresa. Ajude os clientes de forma educada e profissional.
  
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
  
  Seja conciso, educado e solícito.`;

  /**
   * Gera uma resposta para o chatbot usando a API da OpenAI
   * @param messages Histórico de mensagens da conversa
   * @param customSystemPrompt Prompt de sistema personalizado (opcional)
   * @returns Resposta do assistente
   */
  async generateChatResponse(
    messages: ChatMessage[],
    customSystemPrompt?: string
  ): Promise<string> {
    // Verificar se já existe uma mensagem de sistema
    const hasSystemMessage = messages.some(msg => msg.role === 'system');
    
    // Preparar as mensagens para envio
    const finalMessages = hasSystemMessage 
      ? messages 
      : [
          { 
            role: 'system', 
            content: customSystemPrompt || this.defaultSystemPrompt
          },
          ...messages
        ];
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 500,
      });
      
      return response.choices[0].message.content || "Desculpe, não consegui gerar uma resposta.";
    } catch (error) {
      console.error("Erro ao gerar resposta com OpenAI:", error);
      return "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.";
    }
  }

  /**
   * Extrai informações estruturadas de uma conversa
   * @param conversation Histórico completo da conversa
   * @returns Objeto com informações extraídas da conversa
   */
  async extractStructuredInformation(conversation: ChatMessage[]): Promise<{
    name?: string;
    email?: string;
    phone?: string;
    appointment?: {
      date?: string;
      time?: string;
      service?: string;
    };
    interests?: string[];
    hasPendingAppointment: boolean;
  }> {
    const promptMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `Você é um assistente especializado em extrair informações estruturadas de conversas.
        Analise a conversa e extraia as seguintes informações:
        - Nome do cliente
        - Email do cliente (se mencionado)
        - Telefone do cliente (se mencionado)
        - Agendamento (data, hora e tipo de serviço)
        - Interesses do cliente
        - Se há um agendamento pendente para ser confirmado
        
        Responda apenas em formato JSON com as chaves: name, email, phone, appointment (com sub-chaves date, time, service), interests (array) e hasPendingAppointment (boolean).
        Se alguma informação não estiver disponível, omita o campo.`
      },
      ...conversation
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: promptMessages,
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return { hasPendingAppointment: false };
      }

      return JSON.parse(content);
    } catch (error) {
      console.error("Erro ao extrair informações estruturadas:", error);
      return { hasPendingAppointment: false };
    }
  }
}

export const openAIService = new OpenAIService();