"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Field";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { formatAmountInput } from "@/utils/money";

/**
 * Modal de formulario con guardado, estado de carga y avisos.
 * `onSubmit` devuelve el mensaje de éxito, o `false` si la validación falló.
 */
export function FormModal({
  open,
  onClose,
  title,
  description,
  submitLabel = "Guardar",
  onSubmit,
  children,
  size,
  extraFooter,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: () => Promise<string | false>;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  extraFooter?: React.ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const { toast } = useFeedback();

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const msg = await onSubmit();
      if (msg) {
        toast(msg);
        onClose();
      }
    } catch (err) {
      toast(err instanceof Error ? `No se pudo guardar: ${err.message}` : "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          {extraFooter ? <div className="mr-auto">{extraFooter}</div> : null}
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => submit()} loading={saving}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {children}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Campo de dinero en COP con separadores de miles mientras se escribe. */
export function AmountInput({
  id,
  value,
  onChange,
  invalid,
  placeholder = "0",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-dim">$</span>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className="num pl-8 text-[16px]"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(formatAmountInput(e.target.value))}
      />
    </div>
  );
}
