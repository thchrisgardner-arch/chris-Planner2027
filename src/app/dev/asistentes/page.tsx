import { notFound } from "next/navigation";
import { Galeria } from "./Galeria";

// Galería de desarrollo para revisar el arte de los asistentes (no usa datos del usuario).
// Solo existe en desarrollo.
export const instant = false;

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Galeria />;
}
