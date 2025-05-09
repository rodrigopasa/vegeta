import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface NotificationProps {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({
  type,
  title,
  message,
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow time for animation before removing
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-[hsl(var(--success-light))] border-[hsl(var(--success))]';
      case 'error':
        return 'bg-[hsl(var(--error-light))] border-[hsl(var(--error))]';
      case 'info':
        return 'bg-[hsl(var(--secondary))]/10 border-[hsl(var(--secondary))]';
      default:
        return 'bg-[hsl(var(--warning-light))] border-[hsl(var(--warning))]';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--success))] text-white flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        );
      case 'error':
        return (
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--error))] text-white flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        );
      case 'info':
        return (
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--secondary))] text-white flex items-center justify-center">
            <Info className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--warning))] text-white flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        );
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-[hsl(var(--success))]';
      case 'error':
        return 'text-[hsl(var(--error))]';
      case 'info':
        return 'text-[hsl(var(--secondary))]';
      default:
        return 'text-[hsl(var(--warning))]';
    }
  };

  return (
    <div
      className={`fixed bottom-6 right-6 rounded-xl shadow-[var(--shadow-lg)] border-l-4 max-w-md flex items-start transform transition-all duration-300 z-50 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } ${getBgColor()}`}
    >
      <div className="p-4 flex items-start w-full">
        <div className="flex-shrink-0 mr-4">{getIcon()}</div>
        <div className="flex-1">
          <h4 className={`font-semibold text-sm ${getTextColor()}`}>{title}</h4>
          <p className="text-sm text-[hsl(var(--text-dark))] mt-1">{message}</p>
        </div>
        <button
          className="ml-4 text-[hsl(var(--text-light))] hover:text-[hsl(var(--text-dark))] self-start p-1 rounded-full hover:bg-white/40 transition-colors"
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Notification;
