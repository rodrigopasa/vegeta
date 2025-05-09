import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppInstance {
  id: number;
  name: string;
  phoneNumber: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  lastConnectedAt: Date | null;
  isConnected?: boolean;
  isInitialized?: boolean;
  qrCode?: string | null;
  isConnecting?: boolean; // Campo adicional para uso na interface, não persiste no banco
}

interface Contact {
  id: number;
  name: string;
  phoneNumber: string;
  isGroup: boolean;
  memberCount: number | null;
  instanceId: number;
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
  hasMedia?: boolean;
  mediaType?: string;
  mediaPath?: string;
  mediaName?: string;
  mediaCaption?: string;
  instanceId: number;
}

interface WhatsAppContextType {
  instances: WhatsAppInstance[];
  activeInstanceId: number | null;
  setActiveInstanceId: (id: number | null) => void;
  isConnected: boolean;
  isConnecting: boolean;
  qrCode: string | null;
  activeInstance: WhatsAppInstance | null;
  contacts: Contact[];
  groups: Contact[];
  messages: Message[];
  scheduledMessages: Message[];
  
  initializeWhatsApp: (instanceId: number) => Promise<void>;
  refreshContacts: (instanceId: number) => Promise<void>;
  
  getInstanceContacts: (instanceId: number) => Contact[];
  getInstanceGroups: (instanceId: number) => Contact[];
  getInstanceMessages: (instanceId: number) => Message[];
  getInstanceScheduledMessages: (instanceId: number) => Message[];
  
  createInstance: (name: string, phoneNumber: string, description?: string) => Promise<WhatsAppInstance>;
  updateInstance: (id: number, data: Partial<WhatsAppInstance>) => Promise<WhatsAppInstance>;
  deleteInstance: (id: number) => Promise<boolean>;
  
  sendMessage: (instanceId: number, recipient: string, content: string, scheduledFor?: Date, recipientName?: string, isGroup?: boolean, mediaOptions?: {
    hasMedia: boolean;
    mediaType: string;
    mediaPath: string;
    mediaName: string;
    mediaCaption?: string;
  }) => Promise<Message>;
  
  deleteMessage: (id: number) => Promise<boolean>;
}

const WhatsAppContext = createContext<WhatsAppContextType>({} as WhatsAppContextType);

export const useWhatsApp = () => useContext(WhatsAppContext);

interface WhatsAppProviderProps {
  children: ReactNode;
}

export const WhatsAppProvider: React.FC<WhatsAppProviderProps> = ({ children }) => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  // Estado para rastrear quais instâncias estão em processo de conexão
  const [connectingInstances, setConnectingInstances] = useState<Record<number, boolean>>({});
  
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const { toast } = useToast();

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch WhatsApp instances
        await fetchInstances();
        
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

  // Set first instance as active if no active instance
  useEffect(() => {
    if (instances.length > 0 && activeInstanceId === null) {
      setActiveInstanceId(instances[0].id);
    }
  }, [instances, activeInstanceId]);

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
        
        const instanceId = data.payload?.instanceId;
        
        switch (data.type) {
          case 'CONNECTION_STATE':
            if (instanceId) {
              updateInstanceStatus(instanceId, {
                isConnected: data.payload.isConnected,
                qrCode: data.payload.qrCode || null
              });
              
              // Update active instance connection status if this is the active instance
              if (instanceId === activeInstanceId) {
                setIsConnected(data.payload.isConnected);
                if (data.payload.qrCode) {
                  setQrCode(data.payload.qrCode);
                }
              }
            }
            break;
            
          case 'QR_CODE':
            if (instanceId) {
              // Atualizamos apenas os campos que existem no schema
              updateInstanceStatus(instanceId, {
                qrCode: data.payload.qrCode
              });
              
              // Tratamos o estado de conectando no contexto local apenas
              setConnectingInstances(prev => ({ ...prev, [instanceId]: true }));
              
              // Update active QR code if this is the active instance
              if (instanceId === activeInstanceId) {
                setQrCode(data.payload.qrCode);
                setIsConnecting(true);
              }
            }
            break;
            
          case 'AUTHENTICATED':
            if (instanceId) {
              updateInstanceStatus(instanceId, {
                isInitialized: true
              });
              
              toast({
                title: 'Autenticado!',
                description: `WhatsApp #${instanceId} foi autenticado com sucesso.`,
              });
            }
            break;
            
          case 'READY':
            if (instanceId) {
              updateInstanceStatus(instanceId, {
                isConnected: true,
                isInitialized: true,
                qrCode: null
              });
              
              // Update active instance status if this is the active instance
              if (instanceId === activeInstanceId) {
                setIsConnected(true);
                setIsConnecting(false);
                setQrCode(null);
              }
              
              toast({
                title: 'Conectado!',
                description: `WhatsApp #${instanceId} está conectado e pronto para uso.`,
              });
              
              // Refresh data on connection
              fetchContacts();
              fetchMessages();
            }
            break;
            
          case 'DISCONNECTED':
            if (instanceId) {
              updateInstanceStatus(instanceId, {
                isConnected: false
              });
              
              // Update active instance status if this is the active instance
              if (instanceId === activeInstanceId) {
                setIsConnected(false);
              }
              
              toast({
                title: 'Desconectado',
                description: `WhatsApp #${instanceId} foi desconectado: ${data.payload.reason}`,
                variant: 'destructive',
              });
            }
            break;
            
          case 'AUTH_FAILURE':
            if (instanceId) {
              updateInstanceStatus(instanceId, {
                isConnected: false,
                isInitialized: false
              });
              
              // Update active instance status if this is the active instance
              if (instanceId === activeInstanceId) {
                setIsConnected(false);
                setIsConnecting(false);
              }
              
              toast({
                title: 'Falha na autenticação',
                description: `WhatsApp #${instanceId}: ${data.payload.message}`,
                variant: 'destructive',
              });
            }
            break;
            
          case 'CONTACTS_REFRESHED':
            if (instanceId) {
              toast({
                title: 'Contatos atualizados',
                description: `Contatos do WhatsApp #${instanceId} foram atualizados.`,
              });
              fetchContacts();
            }
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
  }, [toast, activeInstanceId]);

  // Helper to update instance status in the instances array
  const updateInstanceStatus = (instanceId: number, updates: Partial<WhatsAppInstance>) => {
    setInstances(prevInstances => 
      prevInstances.map(instance => 
        instance.id === instanceId 
          ? { ...instance, ...updates } 
          : instance
      )
    );
  };

  const fetchInstances = async () => {
    try {
      const response = await fetch('/api/whatsapp/instances');
      const data: WhatsAppInstance[] = await response.json();
      setInstances(data);
      
      // Update connection status for each instance
      for (const instance of data) {
        const statusRes = await fetch(`/api/whatsapp/status?instanceId=${instance.id}`);
        const statusData = await statusRes.json();
        updateInstanceStatus(instance.id, { 
          isConnected: statusData.isConnected,
          qrCode: statusData.qrCode,
          isInitialized: statusData.isInitialized
        });
        
        // Set active instance connection status if this is the active instance
        if (activeInstanceId === instance.id) {
          setIsConnected(statusData.isConnected);
          setQrCode(statusData.qrCode);
        }
      }
    } catch (error) {
      console.error('Error fetching instances:', error);
    }
  };

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

  const initializeWhatsApp = async (instanceId: number) => {
    try {
      // Atualizamos o estado de conexão para a instância ativa
      if (instanceId === activeInstanceId) {
        setIsConnecting(true);
      }
      
      // Atualizamos o estado local e na lista de instâncias
      setConnectingInstances(prev => ({ ...prev, [instanceId]: true }));
      updateInstanceStatus(instanceId, { isConnecting: true });
      
      await apiRequest('POST', '/api/whatsapp/initialize', { instanceId });
    } catch (error) {
      console.error(`Error initializing WhatsApp #${instanceId}:`, error);
      toast({
        title: 'Erro de conexão',
        description: `Não foi possível inicializar o WhatsApp #${instanceId}.`,
        variant: 'destructive',
      });
      
      // Limpar estado de conexão
      if (instanceId === activeInstanceId) {
        setIsConnecting(false);
      }
      
      // Limpar estado de conectando no contexto local e na lista
      setConnectingInstances(prev => ({ ...prev, [instanceId]: false }));
      updateInstanceStatus(instanceId, { isConnecting: false });
    }
  };

  const refreshContacts = async (instanceId: number) => {
    try {
      await apiRequest('POST', '/api/whatsapp/refresh-contacts', { instanceId });
    } catch (error) {
      console.error(`Error refreshing contacts for instance #${instanceId}:`, error);
      toast({
        title: 'Erro de sincronização',
        description: `Não foi possível sincronizar os contatos do WhatsApp #${instanceId}.`,
        variant: 'destructive',
      });
    }
  };

  const createInstance = async (
    name: string, 
    phoneNumber: string, 
    description?: string
  ): Promise<WhatsAppInstance> => {
    try {
      const response = await apiRequest<WhatsAppInstance>('POST', '/api/whatsapp/instances', {
        name,
        phoneNumber,
        description
      });
      
      // Adicionar diretamente a nova instância à lista
      // Esta é uma abordagem mais confiável do que esperar um recarregamento
      setInstances(prev => [...prev, response]);
      
      // Além disso, vamos tentar atualizar a lista completa
      try {
        await fetchInstances();
      } catch (fetchError) {
        console.error('Erro ao atualizar lista de instâncias após criar:', fetchError);
        // Mesmo com erro no fetch, já adicionamos a instância à lista acima
      }
      
      toast({
        title: 'Instância criada',
        description: `Nova instância WhatsApp "${name}" foi criada com sucesso.`,
      });
      
      return response;
    } catch (error) {
      console.error('Error creating WhatsApp instance:', error);
      toast({
        title: 'Erro ao criar instância',
        description: (error as Error).message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateInstance = async (
    id: number, 
    data: Partial<WhatsAppInstance>
  ): Promise<WhatsAppInstance> => {
    try {
      const response = await apiRequest<WhatsAppInstance>('PATCH', `/api/whatsapp/instances/${id}`, data);
      
      // Update instances list
      setInstances(prevInstances => 
        prevInstances.map(instance => 
          instance.id === id 
            ? { ...instance, ...data } 
            : instance
        )
      );
      
      toast({
        title: 'Instância atualizada',
        description: `Instância WhatsApp #${id} foi atualizada com sucesso.`,
      });
      
      return response;
    } catch (error) {
      console.error(`Error updating WhatsApp instance #${id}:`, error);
      toast({
        title: 'Erro ao atualizar instância',
        description: (error as Error).message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteInstance = async (id: number): Promise<boolean> => {
    try {
      await apiRequest('DELETE', `/api/whatsapp/instances/${id}`);
      
      // Update instances list
      setInstances(prevInstances => prevInstances.filter(instance => instance.id !== id));
      
      // If active instance was deleted, set first available instance as active
      if (activeInstanceId === id) {
        const remainingInstances = instances.filter(instance => instance.id !== id);
        if (remainingInstances.length > 0) {
          setActiveInstanceId(remainingInstances[0].id);
        } else {
          setActiveInstanceId(null);
        }
      }
      
      toast({
        title: 'Instância removida',
        description: `Instância WhatsApp #${id} foi removida com sucesso.`,
      });
      
      return true;
    } catch (error) {
      console.error(`Error deleting WhatsApp instance #${id}:`, error);
      toast({
        title: 'Erro ao remover instância',
        description: (error as Error).message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const sendMessage = async (
    instanceId: number,
    recipient: string, 
    content: string, 
    scheduledFor?: Date, 
    recipientName?: string,
    isGroup?: boolean,
    mediaOptions?: {
      hasMedia: boolean;
      mediaType: string;
      mediaPath: string;
      mediaName: string;
      mediaCaption?: string;
    }
  ): Promise<Message> => {
    try {
      const response = await apiRequest<Message>('POST', '/api/messages', {
        instanceId,
        recipient,
        content,
        scheduledFor,
        recipientName,
        isGroup,
        ...(mediaOptions ? {
          hasMedia: mediaOptions.hasMedia,
          mediaType: mediaOptions.mediaType,
          mediaPath: mediaOptions.mediaPath,
          mediaName: mediaOptions.mediaName,
          mediaCaption: mediaOptions.mediaCaption
        } : {})
      });
      
      // Refresh messages after sending
      await fetchMessages();
      
      return response;
    } catch (error) {
      console.error(`Error sending message from instance #${instanceId}:`, error);
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

  // Helper methods to get data for specific instance
  const getInstanceContacts = (instanceId: number) => {
    return contacts.filter(contact => !contact.isGroup && contact.instanceId === instanceId);
  };

  const getInstanceGroups = (instanceId: number) => {
    return contacts.filter(contact => contact.isGroup && contact.instanceId === instanceId);
  };

  const getInstanceMessages = (instanceId: number) => {
    return messages.filter(message => message.instanceId === instanceId);
  };

  const getInstanceScheduledMessages = (instanceId: number) => {
    return messages.filter(message => 
      message.status === 'scheduled' && message.instanceId === instanceId
    );
  };

  // Derived states
  const filteredContacts = activeInstanceId 
    ? contacts.filter(contact => !contact.isGroup && contact.instanceId === activeInstanceId)
    : [];
    
  const groups = activeInstanceId 
    ? contacts.filter(contact => contact.isGroup && contact.instanceId === activeInstanceId)
    : [];
    
  const scheduledMessages = activeInstanceId 
    ? messages.filter(message => message.status === 'scheduled' && message.instanceId === activeInstanceId)
    : [];

  // Computed active instance
  const activeInstance = instances.find(instance => instance.id === activeInstanceId) || null;
  
  return (
    <WhatsAppContext.Provider value={{
      instances,
      activeInstanceId,
      setActiveInstanceId,
      isConnected,
      isConnecting,
      qrCode,
      activeInstance,
      contacts: filteredContacts,
      groups,
      messages,
      scheduledMessages,
      initializeWhatsApp,
      refreshContacts,
      getInstanceContacts,
      getInstanceGroups,
      getInstanceMessages,
      getInstanceScheduledMessages,
      createInstance,
      updateInstance,
      deleteInstance,
      sendMessage,
      deleteMessage,
    }}>
      {children}
    </WhatsAppContext.Provider>
  );
};
