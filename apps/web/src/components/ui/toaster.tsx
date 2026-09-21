"use client";

import * as React from "react";
import { ToastStateProvider, useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

function ToastList() {
  const { toasts, dismiss } = useToast();
  return (
    <ToastProvider>
      {toasts.map((item) => (
        <Toast key={item.id} variant={item.variant} open onOpenChange={(open) => !open && dismiss(item.id)}>
          <div className="grid gap-1 pe-6">
            <ToastTitle>{item.title}</ToastTitle>
            {item.description ? <ToastDescription>{item.description}</ToastDescription> : null}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

function Toaster({ children }: { children?: React.ReactNode }) {
  return (
    <ToastStateProvider>
      {children}
      <ToastList />
    </ToastStateProvider>
  );
}

export { Toaster };
