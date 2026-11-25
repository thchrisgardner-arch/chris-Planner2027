"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Field, Input } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import { LogoMark } from "./Logo";
import { Asistente } from "@/components/asistentes/Asistente";
import { useAsistentes } from "@/lib/asistentes/estado";
import { FICHAS } from "@/lib/asistentes/definiciones";
import { ASISTENTE_IDS, type AsistenteId } from "@/lib/asistentes/tipos";
import { cn } from "@/utils/cn";

const ONBOARDING_KEY = "lifeos:onboarding-done";

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return true;
  }
}

function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* sin almacenamiento: se mostrará de nuevo, no pasa nada */
  }
}

/** Primera vez: pide el nombre para el saludo. Al cerrarla o completarla no vuelve a aparecer. */
export function WelcomeModal({ onDone }: { onDone: () => void }) {
  const { saveProfile, mode } = useData();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const { estado, hacerPrincipal } = useAsistentes();
  const [principal, setPrincipal] = useState<AsistenteId | null>(null);

  const close = () => {
    markOnboardingDone();
    setOpen(false);
    onDone();
  };

  return (
    <FormModal
      open={open}
      onClose={close}
      title="Te damos la bienvenida a LIFE OS"
      description="Tu centro de control personal para 2027."
      submitLabel="Comenzar"
      size="sm"
      onSubmit={async () => {
        if (!name.trim()) {
          setError("Escribe cómo quieres que te saludemos.");
          return false;
        }
        await saveProfile({ full_name: name.trim() });
        if (principal) hacerPrincipal(principal);
        markOnboardingDone();
        onDone();
        return `¡Listo, ${name.trim().split(" ")[0]}!`;
      }}
    >
      <div className="flex items-center gap-3 rounded-[18px] bg-card p-3.5">
        <LogoMark size={38} />
        <p className="text-[13px] leading-relaxed text-muted">
          {mode === "demo"
            ? "Estás en modo demo: nada de lo que hagas se guarda."
            : "Por ahora tus datos se guardan solo en este dispositivo."}
        </p>
      </div>
      <Field label="¿Cómo te llamas?" error={error}>
        {(id) => <Input id={id} value={name} placeholder="Ej. Chris" onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div>
        <p className="mb-2 text-[13.5px] font-medium">Elige a tu asistente principal <span className="font-normal text-muted">(opcional)</span></p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Asistente principal">
          {ASISTENTE_IDS.map((id) => {
            const activo = (principal ?? estado.principal) === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={`${FICHAS[id].nombre}, ${FICHAS[id].modulo}`}
                onClick={() => setPrincipal(id)}
                className={cn("focus-ring flex cursor-pointer flex-col items-center gap-1 rounded-[16px] bg-card p-2 text-[11.5px]", activo && "ring-2 ring-fg")}
              >
                <Asistente id={id} size={48} animado={false} decorativo />
                {FICHAS[id].nombre}
              </button>
            );
          })}
        </div>
      </div>
    </FormModal>
  );
}
