"use client";

/**
 * Link de Next sin precarga automática. Precargar todas las secciones al aparecer los enlaces
 * competía con la primera pantalla; ahora las secciones se precargan juntas cuando el navegador
 * queda libre (PrecargarRutas, en AppShell). Se puede pedir `prefetch` explícito donde haga falta.
 */
import NextLink from "next/link";
import type { ComponentProps } from "react";

export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
