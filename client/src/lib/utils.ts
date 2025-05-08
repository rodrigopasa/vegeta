import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return 'Não agendada';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo', // Horário de São Paulo
    timeZoneName: 'short',
  }).format(dateObj);
}

export function formatPhone(phone: string): string {
  // Handle group IDs or already formatted phone numbers
  if (phone.includes('@g.us') || phone.includes('@c.us')) {
    return phone;
  }
  
  // Remove all non-numeric characters
  const numericPhone = phone.replace(/\D/g, '');
  
  // Brazilian phone number formatting
  if (numericPhone.length === 11) {
    return `+55 ${numericPhone.slice(0, 2)} ${numericPhone.slice(2, 7)}-${numericPhone.slice(7)}`;
  } else if (numericPhone.length === 10) {
    return `+55 ${numericPhone.slice(0, 2)} ${numericPhone.slice(2, 6)}-${numericPhone.slice(6)}`;
  } else {
    return phone; // Return original if format is unknown
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'sent':
    case 'delivered':
    case 'read':
      return 'bg-[hsl(var(--status-success))] text-white';
    case 'failed':
      return 'bg-[hsl(var(--status-error))] text-white';
    case 'scheduled':
    case 'pending':
    case 'sending':
      return 'bg-[hsl(var(--status-pending))] text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

export function getFormattedStatus(status: string): string {
  switch (status) {
    case 'sent':
      return 'Enviada';
    case 'delivered':
      return 'Entregue';
    case 'read':
      return 'Lida';
    case 'failed':
      return 'Falha';
    case 'scheduled':
      return 'Agendada';
    case 'sending':
      return 'Enviando';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// Função para pré-visualizar as variáveis do conteúdo
export function processVariables(content: string, recipientName?: string | null): string {
  if (!content) return '';
  
  const now = new Date();
  
  // Formatar data (Brasil/SP)
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', 
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  });
  
  // Formatar hora (Brasil/SP)
  const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  
  // Processar as variáveis
  return content
    .replace(/\{\{nome\}\}/g, recipientName || 'Cliente')
    .replace(/\{\{data\}\}/g, dateFormatter.format(now))
    .replace(/\{\{hora\}\}/g, timeFormatter.format(now));
}

// Formatação do texto de prévia com variáveis processadas
export function getMessagePreview(content: string, maxLength: number = 50, recipientName?: string | null): string {
  // Processar as variáveis
  const processedContent = processVariables(content, recipientName);
  
  // Truncar se necessário
  if (processedContent.length <= maxLength) return processedContent;
  return processedContent.substring(0, maxLength) + '...';
}

export function truncateText(text: string, maxLength: number = 20): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Formata data para o padrão completo brasileiro com fuso horário de São Paulo
export function formatDateLong(date: Date | string | undefined | null): string {
  if (!date) return 'Não agendada';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo', // Horário de São Paulo
  };
  
  // Formata a data e adiciona o sufixo (BRT)
  return new Intl.DateTimeFormat('pt-BR', options).format(dateObj) + ' (BRT)';
}
