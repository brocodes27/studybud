import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToasterProps {
  toasts?: Toast[];
  removeToast?: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const toastStyles = {
  success: 'bg-success-500/10 border-success-500/20 text-success-100',
  error: 'bg-destructive/10 border-destructive/20 text-red-100',
  warning: 'bg-warning-500/10 border-warning-500/20 text-warning-100',
  info: 'bg-primary-500/10 border-primary-500/20 text-primary-100',
};

const iconStyles = {
  success: 'text-success-400',
  error: 'text-red-400',
  warning: 'text-warning-400',
  info: 'text-primary-400',
};

export const Toaster: React.FC<ToasterProps> = ({ toasts = [], removeToast = () => {} }) => {
  // Don't render if no toasts
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.type];
        return (
          <Toast
            key={toast.id}
            toast={toast}
            icon={Icon}
            onRemove={removeToast}
          />
        );
      })}
    </div>
  );
};

interface ToastProps {
  toast: Toast;
  icon: React.ComponentType<{ className?: string }>;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, icon: Icon, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onRemove(toast.id), 300);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={`transform transition-all duration-300 ease-out ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`flex items-center p-4 rounded-2xl border backdrop-blur-xl shadow-2xl min-w-80 max-w-md ${toastStyles[toast.type]}`}>
        <div className={`flex-shrink-0 ${iconStyles[toast.type]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
        <button
          onClick={handleRemove}
          className="ml-4 flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors duration-200 focus-ring"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};