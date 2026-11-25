"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
}

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface FeedbackValue {
  toast: (message: string, kind?: Toast["kind"]) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setConfirmState(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <Modal
        open={!!confirmState}
        onClose={() => close(false)}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button
              data-autofocus
              variant={confirmState?.destructive ? "danger" : "primary"}
              onClick={() => close(true)}
            >
              {confirmState?.confirmLabel ?? "Confirmar"}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          {confirmState?.destructive ? "Esta acción no se puede deshacer." : "¿Quieres continuar?"}
        </p>
      </Modal>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[14px] border bg-card px-4 py-3 text-[13.5px] animate-in",
              t.kind === "success" ? "border-brand/30" : "border-danger/40",
            )}
          >
            {t.kind === "success" ? (
              <CircleCheck size={20} className="mt-px shrink-0 text-brand-soft" />
            ) : (
              <CircleAlert size={20} className="mt-px shrink-0 text-danger" />
            )}
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              className="cursor-pointer text-dim hover:text-fg"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              aria-label="Cerrar aviso"
            >
              <X size={17} />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback debe usarse dentro de <FeedbackProvider>");
  return ctx;
}
