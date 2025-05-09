import React from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { useAuth } from '@/hooks/use-auth';

const Header: React.FC = () => {
  const { isConnected } = useWhatsApp();
  const auth = useAuth();
  const username = auth?.user?.username || 'Usuário';

  return (
    <header className="bg-[hsl(var(--primary-dark))] text-white py-4 px-6 shadow-md flex items-center justify-between">
      <div className="flex items-center">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[hsl(var(--primary-dark))] mr-4 shadow-[0_4px_12px_rgba(255,255,255,0.2)]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">PaZap</h1>
          <p className="text-xs text-white/80">Disparador de Mensagens</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Connection status indicator */}
        <div className="flex items-center bg-white/10 rounded-full px-4 py-1.5 shadow-inner">
          <span className={`w-2.5 h-2.5 rounded-full mr-2 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
          <span className="text-sm font-medium">{isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}</span>
        </div>
        
        {/* User profile info */}
        <div className="flex items-center bg-white/10 rounded-full px-4 py-1.5 shadow-inner">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mr-2">
            <span className="text-sm font-bold">{username.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-sm font-medium">{username}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
