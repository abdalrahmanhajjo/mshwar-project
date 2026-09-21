"use client";

import * as React from "react";

export type ToastVariant = "default" | "danger";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  toast: (message: Omit<ToastMessage, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastStateProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback((message: Omit<ToastMessage, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { ...message, id }]);
  }, []);

  const value = React.useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);
  return React.createElement(ToastContext.Provider, { value }, children);
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    return {
      toasts: [] as ToastMessage[],
      toast: () => undefined,
      dismiss: () => undefined,
    };
  }
  return context;
}
