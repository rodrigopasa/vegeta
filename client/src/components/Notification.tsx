import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

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

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="text-green-500 text-xl" />;
      case 'error':
        return <XCircle className="text-red-500 text-xl" />;
      case 'info':
        return <Info className="text-blue-500 text-xl" />;
      default:
        return <AlertCircle className="text-yellow-500 text-xl" />;
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-md flex items-start transform transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
    >
      <div className="flex-shrink-0 mr-3">{getIcon()}</div>
      <div className="flex-1">
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-gray-600 mt-1">{message}</p>
      </div>
      <button
        className="ml-4 text-gray-400 hover:text-gray-600 self-start"
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default Notification;
