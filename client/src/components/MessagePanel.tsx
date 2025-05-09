import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWhatsApp } from '@/contexts/WhatsAppContext';

interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MessagePanel: React.FC<MessagePanelProps> = ({ isOpen, onClose }) => {
  // Estado interno para controlar a visibilidade
  const [isVisible, setIsVisible] = useState(isOpen);
  const { toast } = useToast();
  
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
  
  // Se o painel não estiver visível, não renderizar nada
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl rounded-md shadow-lg">
        {/* Header */}
        <div className="bg-green-600 text-white p-4 flex justify-between items-center">
          <h3 className="text-lg font-medium">Nova mensagem</h3>
          <button 
            className="text-white hover:bg-green-700/20 rounded-full p-1.5 transition-colors"
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <p>Conteúdo do painel aqui...</p>
        </div>
      </div>
    </div>
  );
};

export default MessagePanel;