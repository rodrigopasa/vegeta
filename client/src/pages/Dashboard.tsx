import React, { useState } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Calendar, Clock, CheckCircle, Users, MessageSquare, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, getStatusColor, getFormattedStatus, getMessagePreview } from '@/lib/utils';
import QRCodeModal from '@/components/QRCodeModal';
import MessagePanel from '@/components/MessagePanel';
import RateLimitSettings from '@/components/RateLimitSettings';
import NotificationSettings from '@/components/NotificationSettings';

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
        <div className="bg-[hsl(var(--warning-light))] border-l-4 border-[hsl(var(--warning))] rounded-lg p-4 m-4 shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="bg-[hsl(var(--warning))] rounded-full p-2 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-4">
              <h4 className="text-[hsl(var(--warning))] font-medium">Conexão necessária</h4>
              <p className="text-sm text-[hsl(var(--text-dark))] mt-1">
                Você precisa conectar seu WhatsApp para continuar. Clique no botão abaixo para iniciar.
              </p>
              <div className="mt-4">
                <button
                  className="btn btn-primary"
                  onClick={handleConnectWhatsApp}
                >
                  <i className="fas fa-qrcode mr-2"></i>
                  Conectar WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Dashboard content */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[hsl(var(--text-dark))]">Dashboard</h2>
          <div className="text-sm text-[hsl(var(--text-light))]">
            <i className="fas fa-calendar-day mr-2"></i>
            {new Intl.DateTimeFormat('pt-BR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }).format(new Date())}
          </div>
        </div>
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Total messages card */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-[hsl(var(--text-light))]">Total de mensagens</h3>
              <div className="w-10 h-10 bg-[hsl(var(--secondary))]/10 rounded-lg flex items-center justify-center text-[hsl(var(--secondary))]">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-[hsl(var(--text-dark))]">{totalMessages}</p>
                {totalMessages > 0 && (
                  <p className="text-xs font-medium text-[hsl(var(--success))] flex items-center mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--success))] mr-1.5"></span>
                    {sentMessages.length} mensagens enviadas
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Scheduled messages card */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-[hsl(var(--text-light))]">Mensagens agendadas</h3>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-[hsl(var(--text-dark))]">{scheduledCount}</p>
                <p className="text-xs font-medium text-[hsl(var(--text-light))] flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  {nextScheduled ? formatDate(nextScheduled.scheduledFor) : 'Nenhum agendamento'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Success rate card */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-[hsl(var(--text-light))]">Taxa de sucesso</h3>
              <div className="w-10 h-10 bg-[hsl(var(--success-light))] rounded-lg flex items-center justify-center text-[hsl(var(--success))]">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-[hsl(var(--text-dark))]">{successRate}%</p>
                <p className="text-xs font-medium text-[hsl(var(--text-light))] mt-1">
                  Baseado em {totalMessages} mensagens
                </p>
              </div>
            </div>
          </div>
          
          {/* Contacts card */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-[hsl(var(--text-light))]">Contatos ativos</h3>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-[hsl(var(--text-dark))]">{activeContacts}</p>
                <p className="text-xs font-medium text-[hsl(var(--text-light))] mt-1">
                  {contacts.length} contatos, {groups.length} grupos
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent activity and quick actions section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent activity */}
          <div className="lg:col-span-2 card">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[hsl(var(--text-dark))]">Atividade recente</h3>
                <div className="text-[hsl(var(--text-light))] text-sm">
                  <i className="fas fa-history mr-1.5"></i>
                  Últimas atividades
                </div>
              </div>
            </div>
            <div>
              {recentActivities.length > 0 ? (
                <ul className="space-y-4">
                  {recentActivities.map((activity) => (
                    <li key={activity.id} className="flex items-start bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                      <div className="mr-3 mt-1">
                        {activity.status === 'sent' || activity.status === 'delivered' || activity.status === 'read' ? (
                          <div className="w-8 h-8 rounded-full bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] flex items-center justify-center">
                            <i className="fas fa-check"></i>
                          </div>
                        ) : activity.status === 'failed' ? (
                          <div className="w-8 h-8 rounded-full bg-[hsl(var(--error))]/10 text-[hsl(var(--error))] flex items-center justify-center">
                            <i className="fas fa-times"></i>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary))] flex items-center justify-center">
                            <i className="fas fa-clock"></i>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium">
                            Mensagem para{' '}
                            <span className="text-[hsl(var(--primary-dark))]">{activity.recipientName || activity.recipient}</span>
                            {activity.isGroup && ' (grupo)'}
                          </p>
                          <span className={`text-xs rounded-full px-2 py-0.5 ${
                            activity.status === 'sent' || activity.status === 'delivered' || activity.status === 'read' 
                              ? 'badge-success' 
                              : activity.status === 'failed' 
                                ? 'badge-error' 
                                : 'badge-info'
                          }`}>
                            {getFormattedStatus(activity.status)}
                          </span>
                        </div>
                        <p className="text-xs text-[hsl(var(--text-light))] mt-1 flex items-center">
                          <i className="fas fa-calendar-alt mr-1.5"></i>
                          {formatDate(activity.createdAt)}
                          {activity.errorMessage && (
                            <span className="ml-2 text-[hsl(var(--error))]">
                              <i className="fas fa-exclamation-circle mr-1"></i>
                              {activity.errorMessage}
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-inbox text-gray-400 text-xl"></i>
                  </div>
                  <p className="text-[hsl(var(--text-light))]">
                    Nenhuma atividade recente
                  </p>
                </div>
              )}
              {recentActivities.length > 0 && (
                <div className="mt-4 text-center">
                  <a href="/history" className="btn btn-secondary text-sm py-2 px-3">
                    <i className="fas fa-history mr-2"></i>
                    Ver histórico completo
                  </a>
                </div>
              )}
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="card">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h3 className="font-semibold text-[hsl(var(--text-dark))]">Ações rápidas</h3>
            </div>
            <div className="space-y-3">
              <button
                className="btn btn-primary w-full justify-center"
                onClick={() => setShowMessagePanel(true)}
                disabled={!isConnected}
              >
                <i className="fas fa-paper-plane mr-2"></i>
                Nova mensagem
              </button>
              
              <button
                className="btn btn-secondary w-full justify-center"
                onClick={() => {
                  setShowMessagePanel(true);
                }}
                disabled={!isConnected}
              >
                <i className="fas fa-calendar-plus mr-2"></i>
                Agendar mensagem
              </button>
              
              <button
                className="w-full flex items-center justify-center px-4 py-2 rounded-lg bg-white border border-gray-200 text-[hsl(var(--text-dark))] hover:bg-gray-50 transition-colors"
                onClick={refreshContacts}
                disabled={!isConnected}
              >
                <i className="fas fa-sync-alt mr-2"></i>
                Sincronizar contatos
              </button>
              
              {/* Configurações de anti-bloqueio */}
              <div className="mt-6 pt-3 border-t border-gray-100">
                <RateLimitSettings />
              </div>
              
              {/* Configurações de notificação */}
              <div className="mt-6 pt-3 border-t border-gray-100">
                <NotificationSettings />
              </div>
            </div>
          </div>
        </div>
        
        {/* Upcoming scheduled messages */}
        <div className="mt-8 card">
          <div className="border-b border-gray-100 pb-4 mb-4 flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 mr-3">
                <i className="fas fa-calendar-alt"></i>
              </div>
              <h3 className="font-semibold text-[hsl(var(--text-dark))]">Próximas mensagens agendadas</h3>
            </div>
            <a href="/scheduled" className="text-sm text-[hsl(var(--primary-dark))] hover:text-[hsl(var(--primary))] transition-colors flex items-center">
              Ver todas
              <i className="fas fa-chevron-right ml-1.5 text-xs"></i>
            </a>
          </div>
          
          <div>
            {upcomingMessages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th className="px-4 py-3 text-xs font-semibold text-[hsl(var(--text-light))] uppercase tracking-wider">
                        Destinatário
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-[hsl(var(--text-light))] uppercase tracking-wider">
                        Data/Hora
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-[hsl(var(--text-light))] uppercase tracking-wider">
                        Mensagem
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-[hsl(var(--text-light))] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[hsl(var(--text-light))] uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingMessages.map((message, idx) => (
                      <tr key={message.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full ${message.isGroup ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center mr-2`}>
                              <i className={`fas ${message.isGroup ? 'fa-users' : 'fa-user'}`}></i>
                            </div>
                            <span className="text-sm font-medium">
                              {message.recipientName || message.recipient}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="flex items-center text-[hsl(var(--text-light))]">
                            <i className="fas fa-clock mr-2"></i>
                            <span>{formatDate(message.scheduledFor)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="truncate inline-block max-w-xs">
                            {getMessagePreview(message.content)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`badge ${
                            message.status === 'scheduled' ? 'badge-info' :
                            message.status === 'sent' || message.status === 'delivered' || message.status === 'read' ? 'badge-success' :
                            'badge-error'
                          }`}>
                            {getFormattedStatus(message.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              className="w-8 h-8 rounded-full text-[hsl(var(--text-light))] hover:bg-gray-200 hover:text-[hsl(var(--text-dark))] transition-colors flex items-center justify-center"
                              disabled={true}
                              title="Editar (indisponível)"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button 
                              className="w-8 h-8 rounded-full text-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/10 transition-colors flex items-center justify-center"
                              onClick={() => deleteMessage(message.id)}
                              title="Excluir"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-calendar text-purple-500 text-xl"></i>
                </div>
                <p className="text-[hsl(var(--text-light))]">
                  Nenhuma mensagem agendada
                </p>
                <button 
                  className="mt-3 btn btn-primary text-sm py-2"
                  onClick={() => setShowMessagePanel(true)}
                  disabled={!isConnected}
                >
                  <i className="fas fa-calendar-plus mr-2"></i>
                  Agendar mensagem
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* QR Code Modal */}
      <QRCodeModal 
        isOpen={showQRModal} 
        onClose={() => setShowQRModal(false)} 
      />
      
      {/* Message Panel - renderizado incondicionalmente com propriedade de visibilidade */}
      <MessagePanel 
        isOpen={showMessagePanel} 
        onClose={() => setShowMessagePanel(false)} 
      />
    </div>
  );
};

export default Dashboard;
