import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: number;
  name: string;
  phoneNumber: string;
  isGroup: boolean;
  memberCount: number | null;
}

interface Message {
  id: number;
  content: string;
  recipient: string;
  recipientName?: string;
  isGroup: boolean;
  scheduledFor?: Date;
  sentAt?: Date;
  status: string;
  errorMessage?: string;
  createdAt: Date;
}

interface WhatsAppContextType {
  isConnected: boolean;
  isConnecting: boolean;
  qrCode: string | null;
  contacts: Contact[];
  groups: Contact[];
  messages: Message[];
  scheduledMessages: Message[];
  initializeWhatsApp: () => Promise<void>;
  refreshContacts: () => Promise<void>;
  sendMessage: (recipient: string, content: string, scheduledFor?: Date, recipientName?: string, isGroup?: boolean) => Promise<Message>;
  deleteMessage: (id: number) => Promise<boolean>;
}

const WhatsAppContext = createContext<WhatsAppContextType>({} as WhatsAppContextType);

export const useWhatsApp = () => useContext(WhatsAppContext);

interface WhatsAppProviderProps {
  children: ReactNode;
}

export const WhatsAppProvider: React.FC<WhatsAppProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const { toast } = useToast();

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Check WhatsApp connection status
        const statusRes = await fetch('/api/whatsapp/status');
        const statusData = await statusRes.json();
        setIsConnected(statusData.isConnected);
        
        // Fetch contacts
        await fetchContacts();
        
        // Fetch messages
        await fetchMessages();
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    
    fetchInitialData();
    setupWebSocket();
    
    return () => {
      if (webSocket) {
        webSocket.close();
      }
    };
  }, []);

  const setupWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        
        switch (data.type) {
          case 'CONNECTION_STATE':
            setIsConnected(data.payload.isConnected);
            if (data.payload.qrCode) {
              setQrCode(data.payload.qrCode);
            }
            break;
            
          case 'QR_CODE':
            setQrCode(data.payload);
            setIsConnecting(true);
            break;
            
          case 'AUTHENTICATED':
            toast({
              title: 'Autenticado!',
              description: 'Seu WhatsApp foi autenticado com sucesso.',
            });
            break;
            
          case 'READY':
            setIsConnected(true);
            setIsConnecting(false);
            setQrCode(null);
            toast({
              title: 'Conectado!',
              description: 'Seu WhatsApp está conectado e pronto para uso.',
            });
            // Refresh data on connection
            fetchContacts();
            fetchMessages();
            break;
            
          case 'DISCONNECTED':
            setIsConnected(false);
            toast({
              title: 'Desconectado',
              description: `Seu WhatsApp foi desconectado: ${data.payload.reason}`,
              variant: 'destructive',
            });
            break;
            
          case 'AUTH_FAILURE':
            setIsConnected(false);
            setIsConnecting(false);
            toast({
              title: 'Falha na autenticação',
              description: data.payload.message,
              variant: 'destructive',
            });
            break;
            
          case 'CONTACTS_REFRESHED':
            toast({
              title: 'Contatos atualizados',
              description: 'Sua lista de contatos foi atualizada com sucesso.',
            });
            fetchContacts();
            break;
            
          case 'MESSAGE_SENT':
            toast({
              title: 'Mensagem enviada',
              description: 'Sua mensagem foi enviada com sucesso.',
            });
            fetchMessages();
            break;
            
          case 'MESSAGE_SEND_ERROR':
            toast({
              title: 'Erro ao enviar mensagem',
              description: data.payload.error,
              variant: 'destructive',
            });
            fetchMessages();
            break;
            
          case 'MESSAGE_STATUS_UPDATE':
            // Atualizar status de uma mensagem sem precisar recarregar tudo
            setMessages(prevMessages => 
              prevMessages.map(msg => {
                // Em um cenário real, precisaríamos armazenar o WhatsApp message ID
                // junto com nossa mensagem para fazer este match de forma mais precisa
                if (msg.status === 'sent' || msg.status === 'delivered') {
                  return { ...msg, status: data.payload.status };
                }
                return msg;
              })
            );
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (ws.readyState === WebSocket.CLOSED) {
          setupWebSocket();
        }
      }, 5000);
    };
    
    setWebSocket(ws);
  }, [toast]);

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      setContacts(data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/messages');
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const initializeWhatsApp = async () => {
    try {
      setIsConnecting(true);
      await apiRequest('POST', '/api/whatsapp/initialize');
    } catch (error) {
      console.error('Error initializing WhatsApp:', error);
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível inicializar o WhatsApp.',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  };

  const refreshContacts = async () => {
    try {
      await apiRequest('POST', '/api/whatsapp/refresh-contacts');
    } catch (error) {
      console.error('Error refreshing contacts:', error);
      toast({
        title: 'Erro de sincronização',
        description: 'Não foi possível sincronizar os contatos.',
        variant: 'destructive',
      });
    }
  };

  const sendMessage = async (
    recipient: string, 
    content: string, 
    scheduledFor?: Date, 
    recipientName?: string,
    isGroup?: boolean
  ): Promise<Message> => {
    try {
      const response = await apiRequest('POST', '/api/messages', {
        recipient,
        content,
        scheduledFor,
        recipientName,
        isGroup
      });
      
      // Refresh messages after sending
      await fetchMessages();
      
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: (error as Error).message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteMessage = async (id: number): Promise<boolean> => {
    try {
      await apiRequest('DELETE', `/api/messages/${id}`);
      
      // Refresh messages after deleting
      setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== id));
      
      toast({
        title: 'Mensagem removida',
        description: 'A mensagem foi removida com sucesso.',
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Erro ao remover mensagem',
        description: (error as Error).message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const groups = contacts.filter(contact => contact.isGroup);
  const scheduledMessages = messages.filter(message => message.status === 'scheduled');

  return (
    <WhatsAppContext.Provider value={{
      isConnected,
      isConnecting,
      qrCode,
      contacts: contacts.filter(contact => !contact.isGroup),
      groups,
      messages,
      scheduledMessages,
      initializeWhatsApp,
      refreshContacts,
      sendMessage,
      deleteMessage,
    }}>
      {children}
    </WhatsAppContext.Provider>
  );
};
