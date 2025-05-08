import React, { useState } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Calendar, Clock, CheckCircle, Users, MessageSquare, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, getStatusColor, getFormattedStatus, getMessagePreview } from '@/lib/utils';
import QRCodeModal from '@/components/QRCodeModal';
import MessagePanel from '@/components/MessagePanel';

const Dashboard: React.FC = () => {
  const { 
    isConnected, 
    contacts, 
    groups, 
    messages, 
    scheduledMessages, 
    initializeWhatsApp, 
    refreshContacts,
    deleteMessage
  } = useWhatsApp();
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMessagePanel, setShowMessagePanel] = useState(false);

  // Calculate stats
  const totalMessages = messages.length;
  const scheduledCount = scheduledMessages.length;
  const sentMessages = messages.filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read');
  const successRate = totalMessages > 0 
    ? Math.round((sentMessages.length / totalMessages) * 100) 
    : 0;
  const activeContacts = contacts.length + groups.length;
  
  // Get next scheduled message
  const nextScheduled = scheduledMessages
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())[0];
  
  // Recent activities - show last 3 messages
  const recentActivities = [...messages]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);
  
  // Upcoming scheduled messages - show next 2
  const upcomingMessages = [...scheduledMessages]
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
    .slice(0, 2);

  const handleConnectWhatsApp = () => {
    initializeWhatsApp();
    setShowQRModal(true);
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
      case 'read':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'scheduled':
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Connection status banner (shown if not connected) */}
      {!isConnected && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 m-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Você precisa conectar seu WhatsApp para continuar. Clique no botão abaixo para iniciar.
              </p>
              <div className="mt-3">
                <Button
                  className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  onClick={handleConnectWhatsApp}
                >
                  Conectar WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Dashboard content */}
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">Dashboard</h2>
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total messages card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--whatsapp-secondary))]">Total de mensagens</p>
                  <p className="text-2xl font-semibold">{totalMessages}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-2 h-fit">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              {totalMessages > 0 && (
                <p className="text-xs text-[hsl(var(--whatsapp-secondary))] mt-2">
                  <span className="text-green-500">•</span> {sentMessages.length} mensagens enviadas
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Scheduled messages card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--whatsapp-secondary))]">Mensagens agendadas</p>
                  <p className="text-2xl font-semibold">{scheduledCount}</p>
                </div>
                <div className="bg-purple-100 rounded-full p-2 h-fit">
                  <Calendar className="h-5 w-5 text-purple-500" />
                </div>
              </div>
              <p className="text-xs text-[hsl(var(--whatsapp-secondary))] mt-2">
                Próximo envio: {nextScheduled ? formatDate(nextScheduled.scheduledFor) : 'Nenhum'}
              </p>
            </CardContent>
          </Card>
          
          {/* Success rate card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--whatsapp-secondary))]">Taxa de sucesso</p>
                  <p className="text-2xl font-semibold">{successRate}%</p>
                </div>
                <div className="bg-green-100 rounded-full p-2 h-fit">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <p className="text-xs text-[hsl(var(--whatsapp-secondary))] mt-2">
                Baseado em {totalMessages} mensagens
              </p>
            </CardContent>
          </Card>
          
          {/* Contacts card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--whatsapp-secondary))]">Contatos ativos</p>
                  <p className="text-2xl font-semibold">{activeContacts}</p>
                </div>
                <div className="bg-yellow-100 rounded-full p-2 h-fit">
                  <Users className="h-5 w-5 text-yellow-500" />
                </div>
              </div>
              <p className="text-xs text-[hsl(var(--whatsapp-secondary))] mt-2">
                {contacts.length} contatos, {groups.length} grupos
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Recent activity and quick actions section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent activity */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 p-4">
              <h3 className="font-medium">Atividade recente</h3>
            </div>
            <div className="p-4">
              {recentActivities.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {recentActivities.map((activity) => (
                    <li key={activity.id} className="py-3 flex items-start">
                      <span className={`text-xs rounded-full px-2 py-1 mr-3 mt-1 ${getStatusColorClass(activity.status)}`}>
                        {getFormattedStatus(activity.status)}
                      </span>
                      <div>
                        <p className="text-sm">
                          Mensagem {getFormattedStatus(activity.status).toLowerCase()} para{' '}
                          <span className="font-medium">{activity.recipientName || activity.recipient}</span>
                          {activity.isGroup && ' (grupo)'}
                        </p>
                        <p className="text-xs text-[hsl(var(--whatsapp-secondary))] mt-1">
                          {formatDate(activity.createdAt)}
                          {activity.errorMessage && ` • ${activity.errorMessage}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-center text-gray-500 py-4">
                  Nenhuma atividade recente
                </p>
              )}
              {recentActivities.length > 0 && (
                <div className="mt-3 text-center">
                  <a href="/history" className="text-sm text-[hsl(var(--whatsapp-dark-green))] hover:underline">
                    Ver todas as atividades
                  </a>
                </div>
              )}
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 p-4">
              <h3 className="font-medium">Ações rápidas</h3>
            </div>
            <div className="p-4">
              <Button
                className="w-full bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white rounded-lg p-3 font-medium mb-3 flex items-center justify-center"
                onClick={() => setShowMessagePanel(true)}
                disabled={!isConnected}
              >
                <i className="fas fa-paper-plane mr-2"></i>
                Nova mensagem
              </Button>
              <Button
                className="w-full bg-white border border-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-dark-green))] hover:bg-gray-50 rounded-lg p-3 font-medium mb-3 flex items-center justify-center"
                onClick={() => {
                  setShowMessagePanel(true);
                }}
                disabled={!isConnected}
              >
                <i className="fas fa-calendar-plus mr-2"></i>
                Agendar mensagem
              </Button>
              <Button
                className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg p-3 font-medium flex items-center justify-center"
                onClick={refreshContacts}
                disabled={!isConnected}
              >
                <i className="fas fa-sync-alt mr-2"></i>
                Sincronizar contatos
              </Button>
            </div>
          </div>
        </div>
        
        {/* Upcoming scheduled messages */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 p-4 flex justify-between items-center">
            <h3 className="font-medium">Próximas mensagens agendadas</h3>
            <a href="/scheduled" className="text-sm text-[hsl(var(--whatsapp-dark-green))] hover:underline">
              Ver todas
            </a>
          </div>
          <div className="p-4">
            {upcomingMessages.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                      Destinatário
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                      Mensagem
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[hsl(var(--whatsapp-secondary))] uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {upcomingMessages.map((message) => (
                    <tr key={message.id}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <i className={`fas ${message.isGroup ? 'fa-users' : 'fa-user'} text-gray-400 mr-2`}></i>
                          <span className="text-sm font-medium">
                            {message.recipientName || message.recipient}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span>{formatDate(message.scheduledFor)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="truncate inline-block max-w-xs">
                          {getMessagePreview(message.content)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(message.status)}`}>
                          {getFormattedStatus(message.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        <button 
                          className="text-gray-500 hover:text-gray-700 mr-3"
                          disabled={true}
                          title="Editar (indisponível)"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteMessage(message.id)}
                          title="Excluir"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-center text-gray-500 py-4">
                Nenhuma mensagem agendada
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* QR Code Modal */}
      <QRCodeModal 
        isOpen={showQRModal} 
        onClose={() => setShowQRModal(false)} 
      />
      
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

export default Dashboard;
