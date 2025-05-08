import React, { useRef, useState, ChangeEvent } from 'react';
import { X, UserCircle, Users, Phone, Clock, Upload, Table, Send, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from './RichTextEditor';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Paperclip, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPhone } from '@/lib/utils';
import { Spinner } from './Spinner';

interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Recipient {
  phoneNumber: string;
  name?: string;
}

const MessagePanel: React.FC<MessagePanelProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const { isConnected, contacts, groups, sendMessage } = useWhatsApp();
  
  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<string>('saved');
  
  // Common state for all tabs
  const [message, setMessage] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduleDate, setScheduleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [scheduleTime, setScheduleTime] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [isSending, setIsSending] = useState<boolean>(false);
  
  // Saved contact/group tab state
  const [recipientType, setRecipientType] = useState<string>('');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [selectedRecipientName, setSelectedRecipientName] = useState<string>('');
  const [recipientMemberCount, setRecipientMemberCount] = useState<number | null>(null);
  const [isGroup, setIsGroup] = useState<boolean>(false);
  
  // New contact tab state
  const [newRecipientPhone, setNewRecipientPhone] = useState<string>('');
  const [newRecipientName, setNewRecipientName] = useState<string>('');
  
  // CSV import tab state
  const [csvRecipients, setCsvRecipients] = useState<Recipient[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [showRecipientPreview, setShowRecipientPreview] = useState<boolean>(false);
  const [isBulkSending, setIsBulkSending] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<number>(0);
  const [failedRecipients, setFailedRecipients] = useState<string[]>([]);
  
  // Media attachment state
  const [hasMedia, setHasMedia] = useState<boolean>(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string>('');
  const [mediaPath, setMediaPath] = useState<string>('');
  const [mediaName, setMediaName] = useState<string>('');
  const [mediaCaption, setMediaCaption] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Reset form
  const resetForm = () => {
    setRecipientType('');
    setSelectedRecipient('');
    setSelectedRecipientName('');
    setRecipientMemberCount(null);
    setIsGroup(false);
    
    setNewRecipientPhone('');
    setNewRecipientName('');
    
    setCsvRecipients([]);
    setCsvErrors([]);
    setShowRecipientPreview(false);
    setIsBulkSending(false);
    setBulkProgress(0);
    
    // Media attachment
    setHasMedia(false);
    setMediaFile(null);
    setMediaType('');
    setMediaPath('');
    setMediaName('');
    setMediaCaption('');
    setIsUploading(false);
    setUploadError(null);
    
    // Common fields
    setMessage('');
    setIsScheduled(false);
    setScheduleDate(new Date().toISOString().split('T')[0]);
    setScheduleTime(new Date().toTimeString().slice(0, 5));
    setFailedRecipients([]);
  };

  const handleRecipientTypeChange = (value: string) => {
    setRecipientType(value);
    setSelectedRecipient('');
    setSelectedRecipientName('');
    setRecipientMemberCount(null);
    setIsGroup(value === 'group');
  };

  const handleRecipientChange = (value: string) => {
    setSelectedRecipient(value);
    
    // Find recipient details
    let name = '';
    let memberCount = null;
    
    if (recipientType === 'contact') {
      const contact = contacts.find(c => c.phoneNumber === value);
      if (contact) {
        name = contact.name;
      }
    } else if (recipientType === 'group') {
      const group = groups.find(g => g.phoneNumber === value);
      if (group) {
        name = group.name;
        memberCount = group.memberCount;
      }
    }
    
    setSelectedRecipientName(name);
    setRecipientMemberCount(memberCount);
  };

  const handleRemoveRecipient = () => {
    setSelectedRecipient('');
    setSelectedRecipientName('');
    setRecipientMemberCount(null);
  };

  const getScheduledDateTime = () => {
    if (!isScheduled) return undefined;
    
    const [year, month, day] = scheduleDate.split('-');
    const [hour, minute] = scheduleTime.split(':');
    
    // Create date in São Paulo timezone
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00-03:00`);
    return date;
  };

  // Formatar e validar número de telefone
  const formatPhoneNumber = (phone: string): string => {
    // Remove todos os caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '');
    
    // Se começar com 0, remove
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Se não começar com código do país (55 para Brasil), adiciona
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  };
  
  // Validar número de telefone
  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = formatPhoneNumber(phone);
    // Verifica se tem pelo menos 12 dígitos (55 + DDD + número)
    return cleaned.length >= 12;
  };
  
  // Processar arquivo CSV
  const processCSVFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setCsvErrors([]);
    setCsvRecipients([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;
      
      const lines = content.split('\n').filter(line => line.trim());
      const parsedRecipients: Recipient[] = [];
      const errors: string[] = [];
      
      // Processar cada linha
      lines.forEach((line, index) => {
        // Dividir por vírgula ou ponto-e-vírgula
        const parts = line.includes(',') ? line.split(',') : line.split(';');
        
        if (parts.length >= 1) {
          const phoneRaw = parts[0].trim();
          const phone = formatPhoneNumber(phoneRaw);
          
          if (!validatePhoneNumber(phone)) {
            errors.push(`Linha ${index + 1}: Número de telefone inválido "${phoneRaw}"`);
            return;
          }
          
          const name = parts.length > 1 ? parts[1].trim() : undefined;
          parsedRecipients.push({ phoneNumber: phone, name });
        } else {
          errors.push(`Linha ${index + 1}: Formato inválido`);
        }
      });
      
      setCsvRecipients(parsedRecipients);
      setCsvErrors(errors);
      setShowRecipientPreview(true);
      
      if (errors.length > 0) {
        toast({
          title: "Atenção",
          description: `Arquivo importado com ${errors.length} erros.`,
          variant: "destructive"
        });
      } else if (parsedRecipients.length > 0) {
        toast({
          title: "Sucesso",
          description: `${parsedRecipients.length} contatos importados com sucesso.`,
        });
      }
    };
    
    reader.readAsText(file);
    
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Handle media file selection
  const handleMediaFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setHasMedia(false);
      return;
    }
    
    setUploadError(null);
    setMediaFile(file);
    setMediaName(file.name);
    setMediaType(file.type);
    setHasMedia(true);
    setIsUploading(true);
    
    try {
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload the file to the server
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Falha ao carregar o arquivo para o servidor');
      }
      
      const data = await response.json();
      setMediaPath(data.path);
      
      toast({
        title: "Arquivo anexado",
        description: `${file.name} foi anexado com sucesso.`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : "Erro desconhecido ao anexar arquivo");
      
      toast({
        title: "Erro ao anexar arquivo",
        description: "Não foi possível anexar o arquivo. Tente novamente.",
        variant: "destructive"
      });
      
      // Reset media state
      setHasMedia(false);
      setMediaFile(null);
      setMediaName('');
      setMediaType('');
      setMediaPath('');
    } finally {
      setIsUploading(false);
      
      // Reset the file input to allow selecting the same file again
      if (mediaInputRef.current) {
        mediaInputRef.current.value = '';
      }
    }
  };
  
  // Enviar mensagem para contato salvo
  const handleSendToSavedContact = async (immediate: boolean = true) => {
    if (!selectedRecipient || !message.trim()) return;
    
    try {
      setIsSending(true);
      
      const scheduledFor = immediate ? undefined : getScheduledDateTime();
      
      const mediaOptions = hasMedia && mediaPath ? {
        hasMedia,
        mediaType,
        mediaPath,
        mediaName,
        mediaCaption
      } : undefined;
      
      await sendMessage(
        selectedRecipient, 
        message, 
        scheduledFor,
        selectedRecipientName, 
        isGroup,
        mediaOptions
      );
      
      // Close panel on success
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };
  
  // Enviar mensagem para novo contato
  const handleSendToNewContact = async (immediate: boolean = true) => {
    if (!newRecipientPhone || !message.trim()) return;
    
    try {
      setIsSending(true);
      
      const formattedPhone = formatPhoneNumber(newRecipientPhone);
      if (!validatePhoneNumber(formattedPhone)) {
        toast({
          title: "Erro",
          description: "Número de telefone inválido.",
          variant: "destructive"
        });
        return;
      }
      
      const scheduledFor = immediate ? undefined : getScheduledDateTime();
      
      const mediaOptions = hasMedia && mediaPath ? {
        hasMedia,
        mediaType,
        mediaPath,
        mediaName,
        mediaCaption
      } : undefined;
      
      await sendMessage(
        formattedPhone,
        message,
        scheduledFor,
        newRecipientName || formattedPhone,
        false,
        mediaOptions
      );
      
      // Close panel on success
      onClose();
    } catch (error) {
      console.error('Error sending message to new contact:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem para o novo contato.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };
  
  // Enviar mensagens em massa (CSV)
  const handleSendBulkMessages = async (immediate: boolean = true) => {
    if (csvRecipients.length === 0 || !message.trim()) return;
    
    try {
      setIsBulkSending(true);
      setFailedRecipients([]);
      
      const scheduledFor = immediate ? undefined : getScheduledDateTime();
      const failed: string[] = [];
      
      const mediaOptions = hasMedia && mediaPath ? {
        hasMedia,
        mediaType,
        mediaPath,
        mediaName,
        mediaCaption
      } : undefined;
      
      // Estamos enviando de forma sequencial para evitar bloqueio do WhatsApp
      for (let i = 0; i < csvRecipients.length; i++) {
        const recipient = csvRecipients[i];
        setBulkProgress(Math.round(((i + 1) / csvRecipients.length) * 100));
        
        try {
          await sendMessage(
            recipient.phoneNumber,
            message,
            scheduledFor,
            recipient.name || recipient.phoneNumber,
            false,
            mediaOptions
          );
          
          // Pequeno atraso entre mensagens para evitar bloqueio
          if (i < csvRecipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Failed to send to ${recipient.phoneNumber}:`, error);
          failed.push(recipient.phoneNumber);
        }
      }
      
      setFailedRecipients(failed);
      
      if (failed.length === 0) {
        toast({
          title: "Sucesso",
          description: `${csvRecipients.length} mensagens enviadas/agendadas com sucesso.`,
        });
        onClose();
      } else {
        toast({
          title: "Atenção",
          description: `${failed.length} de ${csvRecipients.length} mensagens falharam.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar mensagens em massa.",
        variant: "destructive"
      });
    } finally {
      setIsBulkSending(false);
      setBulkProgress(0);
    }
  };
  
  // Função geral que decide qual método de envio usar com base na aba ativa
  const handleSendMessage = async (immediate: boolean = true) => {
    switch (activeTab) {
      case 'saved':
        return handleSendToSavedContact(immediate);
      case 'new':
        return handleSendToNewContact(immediate);
      case 'csv':
        return handleSendBulkMessages(immediate);
      default:
        return;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 bg-gradient-to-b from-white to-[#f7f9fc] border-l border-gray-200 flex flex-col h-screen overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 bg-[hsl(var(--whatsapp-light-green))] text-white border-b border-[hsl(var(--whatsapp-green))/30] flex justify-between items-center flex-shrink-0">
        <h3 className="font-semibold text-lg flex items-center">
          <MessageCircle className="mr-2 h-5 w-5" />
          Nova mensagem
        </h3>
        <button 
          className="text-white hover:bg-[hsl(var(--whatsapp-dark-green))/20] rounded-full p-1.5 transition-colors"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Recipient selection tabs */}
        <div className="p-4 border-b border-gray-200">
          <Tabs defaultValue="saved" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 mb-4 bg-gray-100 p-1 rounded-md">
              <TabsTrigger value="saved" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[hsl(var(--whatsapp-dark-green))] data-[state=active]:shadow-sm">
                <UserCircle className="h-4 w-4 mr-1" />
                Salvos
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[hsl(var(--whatsapp-dark-green))] data-[state=active]:shadow-sm">
                <Phone className="h-4 w-4 mr-1" />
                Novo
              </TabsTrigger>
              <TabsTrigger value="csv" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[hsl(var(--whatsapp-dark-green))] data-[state=active]:shadow-sm">
                <Table className="h-4 w-4 mr-1" />
                Importar
              </TabsTrigger>
            </TabsList>
            
            {/* Tab: Contatos Salvos */}
            <TabsContent value="saved">
              <div className="space-y-4">
                <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                  <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
                    Tipo de destinatário
                  </label>
                  <Select value={recipientType} onValueChange={handleRecipientTypeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent position="item-aligned">
                      <SelectItem value="contact">Contato</SelectItem>
                      <SelectItem value="group">Grupo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {recipientType && (
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
                      Selecione o {recipientType === 'group' ? 'grupo' : 'contato'}
                    </label>
                    
                    {selectedRecipient ? (
                      /* Selected contact/group */
                      <div className="flex items-center bg-[hsl(var(--whatsapp-light-green))/10] rounded-md p-3 border border-[hsl(var(--whatsapp-light-green))/30]">
                        {isGroup ? (
                          <Users className="h-5 w-5 text-[hsl(var(--whatsapp-green))] mr-2" />
                        ) : (
                          <UserCircle className="h-5 w-5 text-[hsl(var(--whatsapp-green))] mr-2" />
                        )}
                        <span className="text-sm font-medium">{selectedRecipientName}</span>
                        {recipientMemberCount && (
                          <span className="ml-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                            {recipientMemberCount} membros
                          </span>
                        )}
                        <button 
                          className="ml-auto text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1 transition-colors"
                          onClick={handleRemoveRecipient}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      /* Recipient selection dropdown */
                      <Select onValueChange={handleRecipientChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={`Selecione ${recipientType === 'group' ? 'um grupo' : 'um contato'}...`} />
                        </SelectTrigger>
                        <SelectContent position="item-aligned">
                          {recipientType === 'contact' && contacts.map(contact => (
                            <SelectItem 
                              key={contact.id} 
                              value={contact.phoneNumber}
                            >
                              {contact.name}
                            </SelectItem>
                          ))}
                          {recipientType === 'group' && groups.map(group => (
                            <SelectItem 
                              key={group.id} 
                              value={group.phoneNumber}
                            >
                              {group.name} {group.memberCount && `(${group.memberCount})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Tab: Novo Contato */}
            <TabsContent value="new">
              <div className="space-y-4">
                <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                  <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
                    Número do WhatsApp
                  </label>
                  <Input 
                    placeholder="Ex: 55999999999"
                    value={newRecipientPhone}
                    onChange={(e) => setNewRecipientPhone(e.target.value)}
                    className="border-gray-300 focus:border-[hsl(var(--whatsapp-green))] focus:ring focus:ring-[hsl(var(--whatsapp-green))/20]"
                  />
                  <p className="text-xs text-gray-500 mt-1 italic">
                    Inclua o código do país (Ex: 55 para Brasil)
                  </p>
                </div>
                
                <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                  <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
                    Nome (opcional)
                  </label>
                  <Input 
                    placeholder="Nome do contato"
                    value={newRecipientName}
                    onChange={(e) => setNewRecipientName(e.target.value)}
                    className="border-gray-300 focus:border-[hsl(var(--whatsapp-green))] focus:ring focus:ring-[hsl(var(--whatsapp-green))/20]"
                  />
                </div>
                
                {newRecipientPhone && (
                  <div className="bg-[hsl(var(--whatsapp-light-green))/10] rounded-md p-3 border border-[hsl(var(--whatsapp-light-green))/30]">
                    <p className="flex items-center text-sm">
                      <Phone className="h-4 w-4 text-[hsl(var(--whatsapp-green))] mr-2" />
                      <span>Enviando para:</span>
                      <span className="font-medium ml-1">{formatPhone(formatPhoneNumber(newRecipientPhone))}</span>
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Tab: Importar CSV */}
            <TabsContent value="csv">
              <div className="space-y-4">
                <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                  <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
                    Importar contatos via CSV
                  </label>
                  <div className="border-2 border-dashed rounded-md p-4 text-center bg-gray-50">
                    <input 
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".csv,.txt"
                      onChange={processCSVFile}
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="h-4 w-4 mr-2 text-[hsl(var(--whatsapp-green))]" />
                      Selecionar arquivo
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 italic">
                      Formato: telefone,nome (um por linha)
                    </p>
                  </div>
                </div>
                
                {/* Preview dos contatos importados */}
                {showRecipientPreview && (
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))]">
                        Contatos importados ({csvRecipients.length})
                      </label>
                      {csvRecipients.length > 0 && (
                        <button 
                          className="text-xs text-[hsl(var(--whatsapp-dark-green))] hover:underline"
                          onClick={() => setShowRecipientPreview(false)}
                        >
                          Ocultar
                        </button>
                      )}
                    </div>
                    
                    {csvErrors.length > 0 && (
                      <Alert variant="destructive" className="mb-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Erros na importação</AlertTitle>
                        <AlertDescription>
                          <div className="max-h-20 overflow-y-auto text-xs">
                            {csvErrors.map((error, i) => (
                              <div key={i}>{error}</div>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {csvRecipients.length > 0 && (
                      <div className="border rounded-md overflow-hidden shadow-sm">
                        <div className="max-h-32 overflow-y-auto">
                          <table className="min-w-full">
                            <thead className="bg-gray-50 text-xs">
                              <tr>
                                <th className="px-3 py-2 text-left">Telefone</th>
                                <th className="px-3 py-2 text-left">Nome</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-xs bg-white">
                              {csvRecipients.map((recipient, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium">{formatPhone(recipient.phoneNumber)}</td>
                                  <td className="px-3 py-2">{recipient.name || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {/* Progresso de envio em massa */}
                    {isBulkSending && (
                      <div className="mt-3 bg-gray-50 p-3 rounded-md border border-gray-200">
                        <div className="flex justify-between text-xs mb-1 font-medium">
                          <span>Progresso do envio</span>
                          <span>{bulkProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-[hsl(var(--whatsapp-green))] h-2.5 rounded-full transition-all duration-300" 
                            style={{ width: `${bulkProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Lista de falhas */}
                    {failedRecipients.length > 0 && (
                      <div className="mt-3 bg-red-50 p-3 rounded-md border border-red-200">
                        <p className="text-xs text-red-600 font-medium flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Falha ao enviar para {failedRecipients.length} contatos
                        </p>
                        <div className="max-h-20 overflow-y-auto text-xs mt-2">
                          {failedRecipients.map((phone, i) => (
                            <div key={i} className="text-red-500 mb-1 flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                              <span>{formatPhone(phone)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Message composer */}
        <div className="p-4 border-b border-gray-200">
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
              Mensagem
            </label>
            <RichTextEditor
              value={message}
              onChange={setMessage}
              placeholder="Digite sua mensagem aqui..."
            />
          </div>
        </div>
        
        {/* Media attachment */}
        <div className="p-4 border-b border-gray-200">
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))]">
                Anexar arquivo
              </label>
              {hasMedia && (
                <button 
                  className="text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-full transition-colors"
                  onClick={() => {
                    setHasMedia(false);
                    setMediaFile(null);
                    setMediaType('');
                    setMediaPath('');
                    setMediaName('');
                    setMediaCaption('');
                  }}
                >
                  Remover arquivo
                </button>
              )}
            </div>
            
            <div className="media-attachment-container">
              {hasMedia && mediaFile ? (
                <div className="border rounded-md p-3 bg-[hsl(var(--whatsapp-light-green))/5] border-[hsl(var(--whatsapp-light-green))/20]">
                  <div className="flex items-center">
                    <Paperclip className="h-5 w-5 text-[hsl(var(--whatsapp-green))] mr-2" />
                    <div className="overflow-hidden">
                      <p className="font-medium text-sm truncate">{mediaName}</p>
                      <p className="text-xs text-gray-500">{(mediaFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    {isUploading && (
                      <Spinner className="ml-auto h-4 w-4" />
                    )}
                  </div>
                  {mediaPath && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Legenda (opcional)
                      </label>
                      <Input 
                        type="text"
                        placeholder="Digite uma legenda para o arquivo..."
                        value={mediaCaption || ''}
                        onChange={(e) => setMediaCaption(e.target.value)}
                        className="text-sm border-gray-300 focus:border-[hsl(var(--whatsapp-green))] focus:ring focus:ring-[hsl(var(--whatsapp-green))/20]"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-md p-4 text-center bg-gray-50">
                  <input 
                    type="file"
                    ref={mediaInputRef}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png"
                    onChange={handleMediaFileSelect}
                  />
                  <Button
                    variant="outline"
                    onClick={() => mediaInputRef.current?.click()}
                    className="w-full bg-white hover:bg-gray-50 transition-colors"
                    disabled={isUploading}
                  >
                    <Paperclip className="h-4 w-4 mr-2 text-[hsl(var(--whatsapp-green))]" />
                    Selecionar arquivo
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Tipos permitidos: PDF, Word, Excel, imagens
                  </p>
                </div>
              )}
            </div>
            
            {uploadError && (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro ao anexar arquivo</AlertTitle>
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
        
        {/* Scheduling options */}
        <div className="p-4 border-b border-gray-200">
          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Checkbox
                  id="schedule"
                  checked={isScheduled}
                  onCheckedChange={(checked) => setIsScheduled(checked as boolean)}
                  className="border-[hsl(var(--whatsapp-green))] data-[state=checked]:bg-[hsl(var(--whatsapp-green))]"
                />
                <label htmlFor="schedule" className="ml-2 text-sm font-medium">
                  Agendar envio
                </label>
              </div>
              
              <div className="text-xs text-[hsl(var(--whatsapp-secondary))] bg-gray-100 px-2 py-1 rounded-full flex items-center">
                <Clock className="h-3 w-3 inline mr-1" />
                <span>São Paulo (GMT-3)</span>
              </div>
            </div>
            
            {isScheduled && (
              <div className="grid grid-cols-2 gap-3 mt-3 bg-[hsl(var(--whatsapp-light-green))/5] p-3 rounded-md border border-[hsl(var(--whatsapp-light-green))/20]">
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--whatsapp-dark-green))] mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[hsl(var(--whatsapp-green))] focus:ring focus:ring-[hsl(var(--whatsapp-green))/20] text-sm"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--whatsapp-dark-green))] mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[hsl(var(--whatsapp-green))] focus:ring focus:ring-[hsl(var(--whatsapp-green))/20] text-sm"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
        <Button
          className="w-full bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white rounded-lg py-6 font-medium mb-3 flex items-center justify-center transition-colors"
          onClick={() => handleSendMessage(true)}
          disabled={
            (activeTab === 'saved' && !selectedRecipient) || 
            (activeTab === 'new' && !newRecipientPhone) || 
            (activeTab === 'csv' && (!csvRecipients.length || isBulkSending)) || 
            !message.trim() || 
            isSending
          }
        >
          {isSending || isBulkSending ? (
            <Spinner className="h-5 w-5 mr-2" />
          ) : (
            <Send className="h-5 w-5 mr-2" />
          )}
          <span>
            {activeTab === 'csv' 
              ? `Enviar para ${csvRecipients.length} contatos` 
              : 'Enviar agora'
            }
          </span>
        </Button>
        
        <Button
          variant="outline"
          className="w-full border-2 border-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-dark-green))] hover:bg-[hsl(var(--whatsapp-light-green))/10] rounded-lg py-6 font-medium flex items-center justify-center transition-colors"
          onClick={() => handleSendMessage(false)}
          disabled={
            !isScheduled || 
            (activeTab === 'saved' && !selectedRecipient) || 
            (activeTab === 'new' && !newRecipientPhone) || 
            (activeTab === 'csv' && (!csvRecipients.length || isBulkSending)) || 
            !message.trim() || 
            isSending
          }
        >
          <Clock className="h-5 w-5 mr-2" />
          <span>
            {activeTab === 'csv' 
              ? `Agendar para ${csvRecipients.length} contatos` 
              : 'Agendar'
            }
          </span>
        </Button>
      </div>
    </div>
  );
};

export default MessagePanel;