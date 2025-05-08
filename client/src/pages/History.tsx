import React, { useState } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar, CalendarRange, User, Users, AlertTriangle } from 'lucide-react';
import { formatDate, formatDateLong, getStatusColor, getFormattedStatus, processVariables, getMessagePreview } from '@/lib/utils';
import { cn } from '@/lib/utils';

const History: React.FC = () => {
  const { messages } = useWhatsApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter messages
  const filteredMessages = messages.filter(message => {
    // Status filter
    if (statusFilter !== 'all' && message.status !== statusFilter) {
      return false;
    }
    
    // Search term
    const searchLower = searchTerm.toLowerCase();
    return (
      message.recipientName?.toLowerCase().includes(searchLower) ||
      message.recipient.toLowerCase().includes(searchLower) ||
      message.content.toLowerCase().includes(searchLower)
    );
  });

  // Sort by date (most recent first)
  const sortedMessages = [...filteredMessages].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-semibold mb-6">Histórico de Mensagens</h2>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            className="pl-10"
            placeholder="Buscar por destinatário ou conteúdo"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="scheduled">Agendada</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="read">Lida</SelectItem>
              <SelectItem value="failed">Falha</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Message History */}
      {sortedMessages.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                    Destinatário
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                    Mensagem
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                    Data Criação
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                    Data Envio
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedMessages.map((message) => (
                  <tr key={message.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn("px-2 py-1 text-xs rounded-full", getStatusColor(message.status))}>
                        {getFormattedStatus(message.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {message.isGroup ? (
                          <Users className="h-4 w-4 text-gray-400 mr-2" />
                        ) : (
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {message.recipientName || message.recipient}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md truncate">
                        {message.content}
                      </div>
                      
                      {message.content.includes('{{') && (
                        <div className="flex items-center mt-1">
                          <span className="text-xs text-green-600 bg-green-50 px-1 py-0.5 rounded">
                            Com variáveis: {getMessagePreview(message.content, 30, message.recipientName)}
                          </span>
                        </div>
                      )}
                      
                      {message.errorMessage && (
                        <div className="flex items-center mt-1 text-xs text-red-500">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {message.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span title={formatDateLong(message.createdAt)}>
                          {formatDate(message.createdAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {message.scheduledFor ? (
                        <div className="flex items-center">
                          <CalendarRange className="h-3 w-3 mr-1" />
                          <span title={formatDateLong(message.scheduledFor)}>
                            {formatDate(message.scheduledFor)}
                          </span>
                        </div>
                      ) : message.sentAt ? (
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span title={formatDateLong(message.sentAt)}>
                            {formatDate(message.sentAt)}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          {searchTerm || statusFilter !== 'all' ? (
            <>
              <p className="text-[hsl(var(--whatsapp-secondary))] mb-4">
                Nenhuma mensagem encontrada com os filtros atuais
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                Limpar filtros
              </Button>
            </>
          ) : (
            <p className="text-[hsl(var(--whatsapp-secondary))]">
              Nenhuma mensagem no histórico
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default History;
