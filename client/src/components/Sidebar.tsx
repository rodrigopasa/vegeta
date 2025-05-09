import React from 'react';
import { Link, useLocation } from 'wouter';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { useAuth } from '@/hooks/use-auth';

const Sidebar: React.FC = () => {
  const [location] = useLocation();
  const { scheduledMessages } = useWhatsApp();
  const auth = useAuth();
  
  const scheduledCount = scheduledMessages.length;
  const handleLogout = () => {
    if (auth?.logoutMutation) {
      auth.logoutMutation.mutate();
    }
  };

  const menuItems = [
    { path: '/', icon: 'fa-home', label: 'Dashboard' },
    { path: '/contacts', icon: 'fa-address-book', label: 'Contatos' },
    { path: '/groups', icon: 'fa-users', label: 'Grupos' },
    { path: '/scheduled', icon: 'fa-calendar-alt', label: 'Agendadas', count: scheduledCount },
    { path: '/history', icon: 'fa-history', label: 'Histórico' },
    { path: '/chatbot', icon: 'fa-robot', label: 'Chatbot IA' },
    { path: '/chatbot-settings', icon: 'fa-cog', label: 'Configurar Chatbot' },
  ];

  return (
    <nav className="w-16 md:w-64 bg-white shadow-md z-10 rounded-r-xl flex flex-col flex-shrink-0 mx-0.5 my-0.5">
      {/* Logo section for mobile */}
      <div className="md:hidden flex justify-center pt-6 pb-4">
        <div className="w-10 h-10 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </div>
      </div>
      
      {/* Navigation items */}
      <div className="flex flex-col flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {menuItems.map((item) => (
          <Link 
            key={item.path}
            href={item.path}
            className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
              location === item.path
                ? 'text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 font-medium shadow-sm'
                : 'hover:bg-gray-50 text-[hsl(var(--text-light))] hover:text-[hsl(var(--text-dark))]'
            }`}
          >
            <i className={`fas ${item.icon} text-xl w-6`}></i>
            <span className="ml-3 hidden md:block">{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span className="ml-auto bg-[hsl(var(--primary))] text-white text-xs rounded-full px-2 py-1 hidden md:block">
                {item.count}
              </span>
            )}
          </Link>
        ))}
      </div>
      
      {/* Settings and logout */}
      <div className="mt-auto">
        <div className="px-2 pb-2">
          <Link
            href="/settings"
            className="flex items-center px-4 py-3 rounded-lg hover:bg-gray-50 text-[hsl(var(--text-light))] hover:text-[hsl(var(--text-dark))] transition-all duration-200"
          >
            <i className="fas fa-cog text-xl w-6"></i>
            <span className="ml-3 hidden md:block">Configurações</span>
          </Link>
        </div>
        
        {/* User profile section */}
        <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-br-xl">
          <div className="flex items-center">
            <div className="w-9 h-9 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(37,211,102,0.2)]">
              {auth?.user?.username ? (
                <span className="text-sm font-bold">{auth.user.username.charAt(0).toUpperCase()}</span>
              ) : (
                <i className="fas fa-user text-sm"></i>
              )}
            </div>
            <div className="ml-3 hidden md:block">
              <p className="text-sm font-medium text-[hsl(var(--text-dark))]">
                {auth?.user?.username || 'Usuário'}
              </p>
              <p className="text-xs text-[hsl(var(--text-light))]">Administrador</p>
            </div>
            <button 
              onClick={handleLogout}
              className="ml-auto text-[hsl(var(--text-light))] hover:text-[hsl(var(--error))] transition-colors"
              title="Sair"
            >
              <i className="fas fa-sign-out-alt hidden md:block text-lg"></i>
              <i className="fas fa-sign-out-alt md:hidden"></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
