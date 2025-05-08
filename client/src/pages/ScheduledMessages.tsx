import React, { useState } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Calendar, Users, User, Edit, Trash2 } from 'lucide-react';
import { formatDate, getStatusColor, getFormattedStatus, getMessagePreview } from '@/lib/utils';
import MessagePanel from '@/components/MessagePanel';

const ScheduledMessages: React.FC = () => {
  const { scheduledMessages, deleteMessage } = useWhatsApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showMessagePanel, setShowMessagePanel] = useState(false);

  const filteredMessages = scheduledMessages.filter(message =>
    message.recipientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort by scheduled date (most recent first)
  const sortedMessages = [...filteredMessages].sort((a, b) => {
    if (!a.scheduledFor || !b.scheduledFor) return 0;
    return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Mensagens Agendadas</h2>
        <Button
          className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white"
          onClick={() => setShowMessagePanel(true)}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Agendar nova
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            className="pl-10"
            placeholder="Buscar por destinatário ou conteúdo"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Scheduled Messages List */}
      {sortedMessages.length > 0 ? (
        <div className="space-y-4">
          {sortedMessages.map((message) => (
            <Card key={message.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                      {message.isGroup ? (
                        <Users className="h-6 w-6 text-gray-500" />
                      ) : (
                        <User className="h-6 w-6 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">
                        {message.recipientName || message.recipient}
                        {message.isGroup && ' (Grupo)'}
                      </h3>
                      <div className="flex items-center mt-1">
                        <Calendar className="h-3 w-3 text-[hsl(var(--whatsapp-secondary))] mr-1" />
                        <span className="text-xs text-[hsl(var(--whatsapp-secondary))]">
                          Agendada para: {formatDate(message.scheduledFor)}
                        </span>
                      </div>
                      <div className="mt-3 text-sm">
                        {message.content}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(message.status)} mb-2`}>
                      {getFormattedStatus(message.status)}
                    </span>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        disabled={true}
                        title="Editar (indisponível)"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 text-red-500 hover:text-red-700 border-red-200 hover:border-red-400"
                        onClick={() => deleteMessage(message.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          {searchTerm ? (
            <>
              <p className="text-[hsl(var(--whatsapp-secondary))] mb-2">
                Nenhuma mensagem agendada encontrada para "{searchTerm}"
              </p>
              <Button
                variant="link"
                onClick={() => setSearchTerm('')}
                className="text-[hsl(var(--whatsapp-dark-green))]"
              >
                Limpar busca
              </Button>
            </>
          ) : (
            <>
              <Card className="max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="text-center text-lg">Nenhuma mensagem agendada</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-[hsl(var(--whatsapp-secondary))] mb-4">
                    Agende mensagens para enviar automaticamente no futuro
                  </p>
                  <Button
                    className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white"
                    onClick={() => setShowMessagePanel(true)}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendar mensagem
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Message Panel */}
      {showMessagePanel && (
        <MessagePanel 
          isOpen={showMessagePanel} 
          onClose={() => setShowMessagePanel(false)} 
        />
      )}
    </div>
  );
};

export default ScheduledMessages;
