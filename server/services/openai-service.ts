import OpenAI from "openai";
import { log } from '../vite';

class OpenAIService {
  private openai: OpenAI | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Inicializa o serviço OpenAI com a chave de API
   */
  initialize(): boolean {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      log(`Verificando configuração da API OpenAI. Ambiente: ${process.env.NODE_ENV}`, "openai-service");
      
      if (!apiKey) {
        log("Chave de API da OpenAI não configurada", "openai-service");
        return false;
      }

      // Verificar se a chave é válida (não vazia ou apenas espaços)
      if (apiKey.trim() === '') {
        log("Chave de API da OpenAI está vazia ou inválida", "openai-service");
        return false;
      }

      // Verificar formato básico da chave (começa com sk-)
      if (!apiKey.startsWith('sk-')) {
        log("Aviso: a chave da API OpenAI pode estar em um formato inválido (deve começar com 'sk-')", "openai-service");
        // Não retornamos falso aqui, pois o formato pode mudar no futuro
      }

      this.openai = new OpenAI({ apiKey });
      this.initialized = true;

      log("Serviço OpenAI inicializado com sucesso", "openai-service");
      return true;
    } catch (error) {
      log(`Erro ao inicializar serviço OpenAI: ${error}`, "openai-service");
      return false;
    }
  }
  
  // Método para verificar e tentar novamente a inicialização
  async reinitialize(): Promise<boolean> {
    // Se já estiver inicializado, retornar verdadeiro
    if (this.initialized && this.openai) {
      return true;
    }
    
    // Tentar inicializar novamente
    const success = this.initialize();
    
    // Se falhar, tentar usar uma abordagem alternativa
    if (!success) {
      log("Tentando abordagem alternativa para inicializar OpenAI", "openai-service");
      
      try {
        // Verificar se a chave chegou após a inicialização inicial
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (apiKey && apiKey.trim() !== '') {
          this.openai = new OpenAI({ apiKey });
          this.initialized = true;
          log("Serviço OpenAI inicializado com sucesso (reinicialização)", "openai-service");
          return true;
        }
      } catch (error) {
        log(`Erro ao reinicializar serviço OpenAI: ${error}`, "openai-service");
      }
    }
    
    return this.initialized;
  }

  /**
   * Envia uma mensagem para o modelo GPT da OpenAI
   * @param systemPrompt Instruções do sistema
   * @param messages Histórico de mensagens
   * @returns Resposta do modelo
   */
  async sendMessage(systemPrompt: string, messages: any[]): Promise<string> {
    if (!this.initialized || !this.openai) {
      const initialized = await this.reinitialize();
      if (!initialized) {
        throw new Error("Serviço OpenAI não está inicializado");
      }
    }

    try {
      // Preparar mensagens para API
      const systemMessage = {
        role: "system",
        content: systemPrompt
      };

      const formattedMessages = [systemMessage, ...messages];

      // Fazer chamada para API da OpenAI
      // o modelo mais recente da OpenAI é "gpt-4o", que foi lançado em 13 de maio de 2024. não altere isso a menos que explicitamente solicitado pelo usuário
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: formattedMessages as any, // cast para superar questões de tipo
        max_tokens: 1000,
        temperature: 0.7,
      });

      // Extrair resposta
      const reply = response.choices[0].message.content || "";
      return reply;
    } catch (error) {
      log(`Erro ao enviar mensagem para OpenAI: ${error}`, "openai-service");
      throw error;
    }
  }

  /**
   * Analisa o sentimento de um texto usando OpenAI
   * @param text Texto a ser analisado
   * @returns Objeto com dados de análise
   */
  async analyzeSentiment(text: string): Promise<any> {
    if (!this.initialized || !this.openai) {
      const initialized = await this.reinitialize();
      if (!initialized) {
        throw new Error("Serviço OpenAI não está inicializado");
      }
    }

    try {
      // o modelo mais recente da OpenAI é "gpt-4o", que foi lançado em 13 de maio de 2024. não altere isso a menos que explicitamente solicitado pelo usuário
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Você é um analisador de intenções. Extraia informações estruturadas do texto fornecido.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      // Extrair e tentar parsear o JSON da resposta
      const responseText = response.choices[0].message.content || "{}";
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        log(`Erro ao parsear resposta JSON da OpenAI: ${parseError}`, "openai-service");
        return {};
      }
    } catch (error) {
      log(`Erro ao analisar sentimento com OpenAI: ${error}`, "openai-service");
      throw error;
    }
  }

  /**
   * Gera uma imagem a partir de um prompt
   * @param prompt Descrição da imagem desejada
   * @returns URL da imagem gerada
   */
  async generateImage(prompt: string): Promise<string> {
    if (!this.initialized || !this.openai) {
      const initialized = await this.reinitialize();
      if (!initialized) {
        throw new Error("Serviço OpenAI não está inicializado");
      }
    }

    try {
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
      });

      return response.data[0].url || "";
    } catch (error) {
      log(`Erro ao gerar imagem com OpenAI: ${error}`, "openai-service");
      throw error;
    }
  }
}

export const openAIService = new OpenAIService();