/**
 * Utilitários para manipulação e validação de números de telefone
 * Especialmente focado em formatos brasileiros com tratamento do 9 adicional
 */

/**
 * Verifica se um número de telefone está em um formato válido
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // Remove todos os caracteres não-numéricos
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Número vazio não é válido
  if (!cleanNumber) return false;

  // Verifica tamanhos comuns de números de telefone brasileiros
  // Assumindo formatos como:
  // - DDD + número: 10 ou 11 dígitos
  // - País + DDD + número: 12 ou 13 dígitos
  const validLengths = [10, 11, 12, 13];
  
  return validLengths.includes(cleanNumber.length);
}

/**
 * Remove o 9 extra dos números de celular brasileiros
 */
export function removeBrazilianPrefix(phoneNumber: string): string {
  // Remove todos os caracteres não-numéricos
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Caso 1: Número com código do país (55) + DDD (2 dígitos) + 9 + resto (8 dígitos)
  // Ex: 5511912345678 -> 5511[9]12345678 -> 551112345678
  if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
    const ddd = cleanNumber.substring(2, 4);
    const rest = cleanNumber.substring(4);
    
    if (rest.startsWith('9')) {
      return `55${ddd}${rest.substring(1)}`;
    }
  }
  
  // Caso 2: Número com DDD (2 dígitos) + 9 + resto (8 dígitos), sem código do país
  // Ex: 11912345678 -> 11[9]12345678 -> 1112345678
  if (cleanNumber.length === 11) {
    const ddd = cleanNumber.substring(0, 2);
    const rest = cleanNumber.substring(2);
    
    if (rest.startsWith('9')) {
      return `${ddd}${rest.substring(1)}`;
    }
  }
  
  // Caso 3: Número iniciado com 9 seguido de 8 dígitos (sem DDD e sem código país)
  // Ex: 912345678 -> [9]12345678 -> 12345678
  if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
    return cleanNumber.substring(1);
  }
  
  // Se não se encaixar em nenhum dos casos acima, retorna o número original
  return cleanNumber;
}

/**
 * Adiciona o código do país (55 para Brasil) se estiver faltando
 */
export function addCountryCode(phoneNumber: string, countryCode: string = '55'): string {
  // Remove todos os caracteres não-numéricos
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Se já começar com o código do país, retorna como está
  if (cleanNumber.startsWith(countryCode)) {
    return cleanNumber;
  }
  
  // Adiciona o código do país
  return `${countryCode}${cleanNumber}`;
}

/**
 * Formata o número de telefone brasileiro seguindo o padrão do WhatsApp
 * Remove o 9 adicional e adiciona o código do país se necessário
 */
export function formatBrazilianPhoneNumber(
  phoneNumber: string, 
  options: { 
    removePrefixNine?: boolean,
    addCountryCode?: boolean
  } = {}
): string {
  const { removePrefixNine = true, addCountryCode: addCode = true } = options;
  
  // Remove todos os caracteres não-numéricos
  let cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Remove o 9 adicional se necessário
  if (removePrefixNine) {
    cleanNumber = removeBrazilianPrefix(cleanNumber);
  }
  
  // Adiciona o código do país se necessário
  if (addCode && !cleanNumber.startsWith('55')) {
    cleanNumber = addCountryCode(cleanNumber);
  }
  
  return cleanNumber;
}

/**
 * Verifica se dois números de telefone são iguais, ignorando formatação
 */
export function isSamePhoneNumber(phoneNumber1: string, phoneNumber2: string): boolean {
  // Normaliza ambos os números para comparação (remove formatação, 9 adicional, etc)
  const normalized1 = formatBrazilianPhoneNumber(phoneNumber1);
  const normalized2 = formatBrazilianPhoneNumber(phoneNumber2);
  
  return normalized1 === normalized2;
}

/**
 * Formata o número para exibição na interface
 */
export function formatPhoneNumberForDisplay(phoneNumber: string): string {
  // Remove todos os caracteres não-numéricos
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Formato brasileiro com código do país: +55 (11) 91234-5678
  if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
    const ddd = cleanNumber.substring(2, 4);
    const firstPart = cleanNumber.substring(4, 9);
    const secondPart = cleanNumber.substring(9);
    return `+55 (${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Formato brasileiro sem código do país: (11) 91234-5678
  if (cleanNumber.length === 11) {
    const ddd = cleanNumber.substring(0, 2);
    const firstPart = cleanNumber.substring(2, 7);
    const secondPart = cleanNumber.substring(7);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Formato brasileiro sem prefixo 9: (11) 1234-5678
  if (cleanNumber.length === 10) {
    const ddd = cleanNumber.substring(0, 2);
    const firstPart = cleanNumber.substring(2, 6);
    const secondPart = cleanNumber.substring(6);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Outros formatos: retorna como está, apenas agrupando em blocos de 4
  return cleanNumber.replace(/(\d{4})/g, '$1 ').trim();
}