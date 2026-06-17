"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "error" | "info" | "success";

interface ToastInput {
  description?: string;
  title: string;
  variant?: ToastVariant;
}

interface ToastItem extends Required<ToastInput> {
  id: string;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const icons = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
};

const styles = {
  error: "border-destructive/20 bg-white text-destructive",
  info: "border-info/20 bg-white text-info",
  success: "border-success/20 bg-white text-success",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID();
    const nextToast: ToastItem = {
      description: toast.description ?? "",
      id,
      title: toast.title,
      variant: toast.variant ?? "info",
    };

    setToasts((current) => [nextToast, ...current].slice(0, 4));
    window.setTimeout(() => dismiss(id), toast.variant === "error" ? 7000 : 4500);
  }, [dismiss]);

  const value = useMemo(() => showToast, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-3 top-3 z-[100] grid gap-2 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm">
        {toasts.map((toast) => {
          const Icon = icons[toast.variant];
          return (
            <div className={cn("pointer-events-auto flex items-start gap-3 rounded-md border p-3 text-sm shadow-2xl", styles[toast.variant])} key={toast.id}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{toast.title}</p>
                {toast.description ? <p className="mt-1 leading-5 text-muted-foreground">{toast.description}</p> : null}
              </div>
              <Button aria-label="Dismiss notification" className="-mr-2 -mt-2 h-8 w-8 shadow-none" onClick={() => dismiss(toast.id)} size="icon" type="button" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
