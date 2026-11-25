import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";

// Outfit en todo el proyecto: 300 para cifras, 400 texto, 500 títulos
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["300", "400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "LIFE OS 2027",
  description: "Sistema personal para administrar finanzas, proyectos, hábitos, objetivos y calendario.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme lo corrige el script antes de pintar; por eso se suprime el aviso de hidratación
    <html lang="es-CO" data-theme="light" suppressHydrationWarning className={`${outfit.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
