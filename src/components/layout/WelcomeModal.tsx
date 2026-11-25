"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Field, Input } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import { LogoMark } from "./Logo";

/** Primera vez: se pide el nombre para el saludo. No se crean datos de ejemplo. */
export function WelcomeModal() {
  const { saveProfile, mode } = useData();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  return (
    <FormModal
      open={open}
      onClose={() => setOpen(false)}
      title="Bienvenido a LIFE OS 2027"
      description="Tu centro de control personal. Empecemos por lo básico."
      submitLabel="Comenzar"
      size="sm"
      onSubmit={async () => {
        if (!name.trim()) {
          setError("Escribe cómo quieres que te salude.");
          return false;
        }
        await saveProfile({ full_name: name.trim() });
        return `¡Listo, ${name.trim().split(" ")[0]}!`;
      }}
    >
      <div className="flex items-center gap-3 rounded-[14px] border border-line bg-bg-2 p-3.5">
        <LogoMark size={38} />
        <p className="text-[12.5px] leading-relaxed text-muted">
          {mode === "local"
            ? "Modo local: todo lo que registres se guarda solo en este navegador hasta que conectes Supabase."
            : "Tus datos se guardan en tu cuenta con acceso privado."}
        </p>
      </div>
      <Field label="Tu nombre" error={error}>
        {(id) => <Input id={id} value={name} placeholder="Ej. Chris" onChange={(e) => setName(e.target.value)} />}
      </Field>
    </FormModal>
  );
}
