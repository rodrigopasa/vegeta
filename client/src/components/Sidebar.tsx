import React from 'react';
import { Link, useLocation } from 'wouter';
import { useWhatsApp } from '@/contexts/WhatsAppContext';

const Sidebar: React.FC = () => {
  const [location] = useLocation();
  const { scheduledMessages } = useWhatsApp();
  
  const scheduledCount = scheduledMessages.length;

  const menuItems = [
    { path: '/', icon: 'fa-home', label: 'Dashboard' },
    { path: '/instances', icon: 'fa-mobile-alt', label: 'Instâncias' },
    { path: '/contacts', icon: 'fa-address-book', label: 'Contatos' },
    { path: '/groups', icon: 'fa-users', label: 'Grupos' },
    { path: '/scheduled', icon: 'fa-calendar-alt', label: 'Agendadas', count: scheduledCount },
    { path: '/history', icon: 'fa-history', label: 'Histórico' },
  ];

  return (
    <nav className="w-16 md:w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Navigation items */}
      <div className="flex flex-col flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => (
          <Link 
            key={item.path}
            href={item.path}
            className={`flex items-center px-4 py-3 ${
              location === item.path
                ? 'text-[hsl(var(--whatsapp-dark-green))] bg-[hsl(var(--whatsapp-light))/50] border-l-4 border-[hsl(var(--whatsapp-green))]'
                : 'hover:bg-[hsl(var(--whatsapp-light))/50] transition-colors text-gray-700'
            }`}
          >
            <i className={`fas ${item.icon} text-xl w-6 ${location === item.path ? '' : 'text-[hsl(var(--whatsapp-secondary))]'}`}></i>
            <span className="ml-3 hidden md:block font-medium">{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span className="ml-auto bg-[hsl(var(--whatsapp-green))] text-white text-xs rounded-full px-2 py-1 hidden md:block">
                {item.count}
              </span>
            )}
          </Link>
        ))}
      </div>
      
      {/* User profile section */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-[hsl(var(--whatsapp-green))] rounded-full flex items-center justify-center text-white">
            <span className="text-sm font-medium">WA</span>
          </div>
          <div className="ml-3 hidden md:block">
            <p className="text-sm font-medium">WhatsApp Scheduler</p>
            <p className="text-xs text-[hsl(var(--whatsapp-secondary))]">São Paulo, Brasil</p>
          </div>
          <button className="ml-auto text-[hsl(var(--whatsapp-secondary))]">
            <i className="fas fa-sign-out-alt hidden md:block"></i>
            <i className="fas fa-ellipsis-v md:hidden"></i>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
