import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  success: 'bg-neo-secondary border-white/10 text-slate-100',
  error: 'bg-neo-accent border-white/10 text-slate-100',
  warning: 'bg-neo-muted border-white/10 text-slate-100',
  info: 'bg-slate-800 border-white/10 text-slate-100',
};

const iconStyles = {
  success: 'text-slate-100',
  error: 'text-slate-100',
  warning: 'text-slate-100',
  info: 'text-slate-100',
};

export const Toaster: React.FC<ToasterProps> = ({ toasts = [], removeToast = () => { } }) => {
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-8 right-8 z-[100] flex flex-col gap-6 items-end">
      <AnimatePresence mode="popLayout">
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
      </AnimatePresence>
    </div>
  );
};

interface ToastProps {
  toast: Toast;
  icon: LucideIcon;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, icon: Icon, onRemove }) => {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  return (
    <motion.div
      layout
      initial={{ x: 100, opacity: 0, rotate: 5 }}
      animate={{ x: 0, opacity: 1, rotate: 0 }}
      exit={{ x: 100, opacity: 0, scale: 0.9 }}
      className={`relative group border ${toastStyles[toast.type]} shadow-neo p-6 min-w-[320px] max-w-md flex items-center gap-5`}
    >
      <div className={`flex-shrink-0 ${iconStyles[toast.type]} bg-slate-800 border border-white/10 p-2 -rotate-3 group-hover:rotate-0 transition-transform`}>
        <Icon className="w-6 h-6" strokeWidth={3} />
      </div>

      <div className="flex-1">
        <p className="font-black uppercase tracking-tight italic text-lg leading-tight">
          {toast.message}
        </p>
      </div>

      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 bg-slate-800 border border-white/10 p-2 shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all hover:bg-neo-accent"
      >
        <X className="w-5 h-5 text-slate-100 stroke-[3px]" />
      </button>

      {/* Background patterns */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none overflow-hidden">
        <div
          className="w-full h-full"
          style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '8px 8px' }}
        />
      </div>
    </motion.div>
  );
};
