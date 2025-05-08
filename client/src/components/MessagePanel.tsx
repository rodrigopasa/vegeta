import React, { useState, useEffect } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import RichTextEditor from './RichTextEditor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Send, Clock, Users, UserCircle, Plus } from 'lucide-react';
import { Spinner } from '@/components/Spinner';

interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MessagePanel: React.FC<MessagePanelProps> = ({ isOpen, onClose }) => {
  const { contacts, groups, sendMessage } = useWhatsApp();
  const [recipientType, setRecipientType] = useState<string>('');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [selectedRecipientName, setSelectedRecipientName] = useState<string>('');
  const [recipientMemberCount, setRecipientMemberCount] = useState<number | null>(null);
  const [isGroup, setIsGroup] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduleDate, setScheduleDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [scheduleTime, setScheduleTime] = useState<string>(
    new Date().toTimeString().slice(0, 5)
  );
  const [isSending, setIsSending] = useState<boolean>(false);

  // Reset form when closing
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setRecipientType('');
    setSelectedRecipient('');
    setSelectedRecipientName('');
    setRecipientMemberCount(null);
    setIsGroup(false);
    setMessage('');
    setIsScheduled(false);
    setScheduleDate(new Date().toISOString().split('T')[0]);
    setScheduleTime(new Date().toTimeString().slice(0, 5));
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

  const handleSendMessage = async (immediate: boolean = true) => {
    if (!selectedRecipient || !message.trim()) return;
    
    try {
      setIsSending(true);
      
      const scheduledFor = immediate ? undefined : getScheduledDateTime();
      
      await sendMessage(
        selectedRecipient, 
        message, 
        scheduledFor,
        selectedRecipientName, 
        isGroup
      );
      
      // Close panel on success
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium">Nova mensagem</h3>
        <button 
          className="text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Recipient selection */}
      <div className="p-4 border-b border-gray-200">
        <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
          Destinatário
        </label>
        <div className="flex">
          <div className="flex-1">
            <Select value={recipientType} onValueChange={handleRecipientTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contact">Contato</SelectItem>
                <SelectItem value="group">Grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="ml-2"
            disabled={!recipientType}
          >
            <Plus size={18} />
          </Button>
        </div>
        
        {recipientType && (
          <div className="mt-3">
            {selectedRecipient ? (
              /* Selected contact/group */
              <div className="flex items-center bg-gray-100 rounded-md p-2">
                {isGroup ? (
                  <Users className="h-4 w-4 text-gray-500 mr-2" />
                ) : (
                  <UserCircle className="h-4 w-4 text-gray-500 mr-2" />
                )}
                <span className="text-sm">{selectedRecipientName}</span>
                {recipientMemberCount && (
                  <span className="ml-1 text-xs text-gray-500">
                    ({recipientMemberCount} membros)
                  </span>
                )}
                <button 
                  className="ml-auto text-gray-500 hover:text-gray-700"
                  onClick={handleRemoveRecipient}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              /* Recipient selection dropdown */
              <Select onValueChange={handleRecipientChange}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione ${recipientType === 'group' ? 'um grupo' : 'um contato'}...`} />
                </SelectTrigger>
                <SelectContent>
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
      
      {/* Message composer */}
      <div className="p-4 border-b border-gray-200 flex-1 overflow-auto">
        <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))] mb-2">
          Mensagem
        </label>
        <RichTextEditor
          value={message}
          onChange={setMessage}
          placeholder="Digite sua mensagem aqui..."
        />
      </div>
      
      {/* Scheduling options */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Checkbox
              id="schedule"
              checked={isScheduled}
              onCheckedChange={(checked) => setIsScheduled(checked as boolean)}
            />
            <label htmlFor="schedule" className="ml-2 text-sm">
              Agendar envio
            </label>
          </div>
          
          <div className="text-xs text-[hsl(var(--whatsapp-secondary))]">
            <Clock className="h-3 w-3 inline mr-1" />
            <span>Fuso horário: São Paulo (GMT-3)</span>
          </div>
        </div>
        
        {isScheduled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[hsl(var(--whatsapp-secondary))] mb-1">
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
              <label className="block text-xs text-[hsl(var(--whatsapp-secondary))] mb-1">
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
      
      {/* Action buttons */}
      <div className="p-4">
        <Button
          className="w-full bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white rounded-lg p-3 font-medium mb-3 flex items-center justify-center transition-colors"
          onClick={() => handleSendMessage(true)}
          disabled={!selectedRecipient || !message.trim() || isSending}
        >
          {isSending ? (
            <Spinner className="h-5 w-5 mr-2" />
          ) : (
            <Send className="h-5 w-5 mr-2" />
          )}
          <span>Enviar agora</span>
        </Button>
        
        <Button
          variant="outline"
          className="w-full border border-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-dark-green))] hover:bg-gray-50 rounded-lg p-3 font-medium flex items-center justify-center transition-colors"
          onClick={() => handleSendMessage(false)}
          disabled={!isScheduled || !selectedRecipient || !message.trim() || isSending}
        >
          <Clock className="h-5 w-5 mr-2" />
          <span>Agendar</span>
        </Button>
      </div>
    </div>
  );
};

export default MessagePanel;
