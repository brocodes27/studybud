import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastQueue: Toast[] = [];
let setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast: Toast = {
    id: Math.random().toString(36).substr(2, 9),
    message,
    type
  };
  
  toastQueue.push(toast);
  
  if (setToasts) {
    setToasts([...toastQueue]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(toast.id);
    }, 5000);
  }
}

function removeToast(id: string) {
  toastQueue = toastQueue.filter(toast => toast.id !== id);
  if (setToasts) {
    setToasts([...toastQueue]);
  }
}

export function Toaster() {
  const [toasts, setToastsState] = useState<Toast[]>([]);

  useEffect(() => {
    setToasts = setToastsState;
    return () => {
      setToasts = null;
    };
  }, []);

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      default:
        return <Info className="h-5 w-5 text-blue-400" />;
    }
  };

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'glass border-green-500/30 glow-green';
      case 'error':
        return 'glass border-red-500/30';
      default:
        return 'glass border-blue-500/30 glow-blue';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 p-4 rounded-xl border shadow-2xl max-w-sm animate-in slide-in-from-right ${getToastStyles(toast.type)}`}
        >
          {getToastIcon(toast.type)}
          <p className="flex-grow text-sm font-medium text-white">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 hover:opacity-70 transition-opacity duration-200 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}