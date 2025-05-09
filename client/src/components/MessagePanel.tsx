import React, { useRef, useState, useEffect, ChangeEvent } from 'react';
import { X, UserCircle, Users, Phone, Clock, Upload, Table, Send, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from './RichTextEditor';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPhone } from '@/lib/utils';
import { Spinner } from './Spinner';
import FileUploader from './FileUploader';
import CSVImporter from './CSVImporter';

interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Recipient {
  phoneNumber: string;
  name?: string;
}

const MessagePanel: React.FC<MessagePanelProps> = ({ isOpen, onClose }) => {
  // Estado interno para controlar a visibilidade
  const [isVisible, setIsVisible] = useState(isOpen);
  const { toast } = useToast();
  const { isConnected, contacts, groups, sendMessage } = useWhatsApp();
  
  // Referências
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado da aba ativa
  const [activeTab, setActiveTab] = useState<string>('saved');
  
  // Estado do conteúdo da mensagem
  const [message, setMessage] = useState<string>('');
  
  // Estado para o tipo de destinatário (contato ou grupo)
  const [recipientType, setRecipientType] = useState<string>('');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [selectedRecipientName, setSelectedRecipientName] = useState<string>('');
  const [isGroup, setIsGroup] = useState<boolean>(false);
  
  // Estado para novo contato
  const [newRecipientPhone, setNewRecipientPhone] = useState<string>('');
  const [newRecipientName, setNewRecipientName] = useState<string>('');
  
  // Estado para envio
  const [isSending, setIsSending] = useState<boolean>(false);
  
  // Estado para anexo de arquivos 
  const [hasMedia, setHasMedia] = useState<boolean>(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string>('');
  const [mediaPath, setMediaPath] = useState<string>('');
  const [mediaName, setMediaName] = useState<string>('');
  const [mediaCaption, setMediaCaption] = useState<string>('');
  
  // Sincronizar o estado interno com a prop quando ela muda
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true); 
    }
  }, [isOpen]);
  
  // Função de fechamento que atualiza o estado interno e chama a função do pai
  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };
  
  // Reset do formulário
  const resetForm = () => {
    setRecipientType('');
    setSelectedRecipient('');
    setSelectedRecipientName('');
    setIsGroup(false);
    setNewRecipientPhone('');
    setNewRecipientName('');
    setMessage('');
    setHasMedia(false);
    setMediaFile(null);
    setMediaType('');
    setMediaPath('');
    setMediaName('');
    setMediaCaption('');
  };
  
  // Controlar mudança no tipo de destinatário
  const handleRecipientTypeChange = (value: string) => {
    setRecipientType(value);
    setSelectedRecipient('');
    setSelectedRecipientName('');
    setIsGroup(value === 'group');
  };
  
  // Controlar seleção de destinatário existente
  const handleRecipientChange = (value: string) => {
    setSelectedRecipient(value);
    
    let name = '';
    
    if (recipientType === 'contact') {
      const contact = contacts.find(c => c.phoneNumber === value);
      if (contact) {
        name = contact.name;
      }
    } else if (recipientType === 'group') {
      const group = groups.find(g => g.phoneNumber === value);
      if (group) {
        name = group.name;
      }
    }
    
    setSelectedRecipientName(name);
  };
  
  // Formatar número de telefone
  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  };
  
  // Enviar mensagem para contato salvo
  const handleSendToSavedContact = async () => {
    if (!selectedRecipient || !message.trim()) return;
    
    try {
      setIsSending(true);
      
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
        undefined,
        selectedRecipientName, 
        isGroup,
        mediaOptions
      );
      
      // Fechar painel após envio bem-sucedido
      handleClose();
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
  const handleSendToNewContact = async () => {
    if (!newRecipientPhone || !message.trim()) return;
    
    try {
      setIsSending(true);
      
      const formattedPhone = formatPhoneNumber(newRecipientPhone);
      
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
        undefined,
        newRecipientName || formattedPhone,
        false,
        mediaOptions
      );
      
      // Fechar painel após envio bem-sucedido
      handleClose();
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
  
  // Função geral que decide qual método de envio usar com base na aba ativa
  const handleSendMessage = async () => {
    switch (activeTab) {
      case 'saved':
        return handleSendToSavedContact();
      case 'new':
        return handleSendToNewContact();
      default:
        return;
    }
  };
  
  // Se o painel não estiver visível, não renderizar nada
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl h-[90vh] rounded-md shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[hsl(var(--whatsapp-green))] text-white p-4 flex justify-between items-center">
          <h3 className="text-lg font-medium flex items-center">
            <MessageCircle className="h-5 w-5 mr-2" />
            Nova mensagem
          </h3>
          <button 
            className="text-white hover:bg-[hsl(var(--whatsapp-dark-green))/20] rounded-full p-1.5 transition-colors"
            onClick={handleClose}
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
                          <button 
                            className="ml-auto text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1 transition-colors"
                            onClick={() => {
                              setSelectedRecipient('');
                              setSelectedRecipientName('');
                            }}
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
                <div className="space-y-4 mb-4">
                  <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                    <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
                      Importar contatos
                    </label>
                    <p className="text-sm text-gray-500 mb-4">
                      Importe contatos de um arquivo CSV para envio em massa. O arquivo deve conter colunas para nome e número de telefone.
                    </p>
                    
                    <CSVImporter
                      onComplete={(importedContacts) => {
                        // Quando o usuário terminar de importar os contatos
                        // Vamos manter a mensagem, mas alterar para a aba de envio em massa
                        toast({
                          title: "Contatos importados",
                          description: `${importedContacts.length} contatos importados com sucesso. Agora você pode enviar mensagens em massa.`,
                        });
                        
                        // Você pode implementar a lógica para enviar mensagens em massa aqui
                        // Ou simplesmente mostrar os contatos importados
                        console.log("Contatos importados:", importedContacts);
                      }}
                    />
                  </div>
                  
                  <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-amber-800">Importante sobre envio em massa</h4>
                        <p className="text-xs text-amber-700 mt-1">
                          O envio em massa de mensagens está sujeito às políticas de uso do WhatsApp. 
                          Use de forma responsável e sempre configure os limites de taxa de envio adequadamente para evitar bloqueios.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Message editor */}
          <div className="p-4 border-b border-gray-200">
            <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
              Mensagem
            </label>
            <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
              <RichTextEditor 
                value={message}
                onChange={setMessage}
                placeholder="Digite sua mensagem aqui..."
              />
            </div>
          </div>
        
          {/* Media attachment */}
          <div className="p-4 border-b border-gray-200">
            <FileUploader 
              onFileUploaded={(fileData) => {
                // Atualizar todos os estados relacionados a mídia
                setHasMedia(fileData.hasMedia);
                setMediaFile(fileData.mediaFile);
                setMediaType(fileData.mediaType);
                setMediaPath(fileData.mediaPath);
                setMediaName(fileData.mediaName);
                setMediaCaption(fileData.mediaCaption);
              }} 
            />
          </div>
        </div>
        
        {/* Footer with actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleClose}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            
            <Button
              onClick={handleSendMessage}
              className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white flex items-center"
              disabled={isSending}
            >
              {isSending ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagePanel;