import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import i18n from '../i18n';
import { cn } from '../lib/cn';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

const toneStyles: Record<ToastTone, string> = {
  success: 'border-green-300 bg-green-50 text-green-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-blue-300 bg-blue-50 text-blue-900',
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {tone === 'success' ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </>
      ) : tone === 'error' ? (
        <>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </>
      )}
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastPrimitive.Provider swipeDirection="right">
        {toasts.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-md border p-3 text-sm shadow-lg data-[swipe=end]:opacity-0 data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
              toneStyles[item.tone],
            )}
          >
            <ToastIcon tone={item.tone} />
            <ToastPrimitive.Title className="flex-1">{item.message}</ToastPrimitive.Title>
            <ToastPrimitive.Close
              aria-label={i18n.t('common.close')}
              onClick={() => dismiss(item.id)}
              className="rounded p-1 text-current opacity-60 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
