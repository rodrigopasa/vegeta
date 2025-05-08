import React from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';

const Header: React.FC = () => {
  const { isConnected } = useWhatsApp();

  return (
    <header className="bg-[hsl(var(--whatsapp-dark-green))] text-white py-3 px-4 shadow-md flex items-center justify-between">
      <div className="flex items-center">
        <i className="fas fa-comment-dots text-2xl mr-3"></i>
        <h1 className="text-xl font-semibold">WhatsApp Scheduler</h1>
      </div>
      
      {/* Connection status indicator */}
      <div className="flex items-center bg-white/10 rounded-full px-3 py-1">
        <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
        <span className="text-sm">{isConnected ? 'Conectado' : 'Desconectado'}</span>
      </div>
    </header>
  );
};

export default Header;
