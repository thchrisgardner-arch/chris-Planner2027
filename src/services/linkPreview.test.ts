import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fromHtml, leerMonto, limpiarTitulo, monedaDe, paginaBloqueada } from "./linkPreview";

const fx = (f: string) => readFileSync(join(process.cwd(), "src/services/fixtures", f), "utf8");

describe("Amazon (páginas reales recortadas)", () => {
  it("producto sin precio en Colombia: título limpio e imagen en alta resolución", () => {
    const p = fromHtml(fx("amazon-echo-dot.html"), "https://www.amazon.com/dp/B09B8V1LZ3");
    expect(p.title).toMatch(/^Amazon Echo Dot \(5\.ª generación\)/);
    expect(p.title).not.toMatch(/Amazon\.com:|Dispositivos Amazon/);
    expect(p.image).toBe("https://m.media-amazon.com/images/I/61J2sQtBYDL._AC_SL1500_.jpg");
    // El 195,489 de la página es de un producto relacionado, no de este
    expect(p.price).toBeNull();
    expect(p.bloqueado).toBe(false);
  });
  it("libro con precio en pesos en formato de amazon.com (COP 53,289.45)", () => {
    const p = fromHtml(fx("amazon-libro-cop.html"), "https://www.amazon.com/dp/0593135202");
    expect(p.price).toBe(53_289);
    expect(p.currency).toBe("COP");
    expect(p.title).toMatch(/^Project Hail Mary/);
  });
  it("precio en dólares: 24.00 son 24 dólares (y no el $9.99 de abajo ni el «$2400» oculto)", () => {
    const p = fromHtml(fx("amazon-precio-usd.html"), "https://www.amazon.com/dp/B0SOPORTE");
    expect(p.price).toBe(24);
    expect(p.currency).toBe("USD");
    expect(p.title).toBe("Soporte para celular ajustable, aluminio");
    expect(p.image).toBe("https://m.media-amazon.com/images/I/61abcSoporteL._AC_SL1500_.jpg");
  });
  it("página en inglés sin precio principal: título sin «| Amazon»", () => {
    const p = fromHtml(fx("amazon-usd.html"), "https://www.amazon.com/dp/B09B8V1LZ3");
    expect(p.title).toMatch(/^Amazon Echo Dot \(5th gen\)/);
    expect(p.image).toMatch(/^https:\/\/m\.media-amazon\.com\/images\/I\/.+\.jpg$/);
  });
  it("página de verificación (captcha): se avisa y se conserva lo que se pueda", () => {
    expect(paginaBloqueada(fx("amazon-captcha.html"), "https://www.amazon.com/dp/B0X")).toBe(true);
    const p = fromHtml(fx("amazon-captcha.html"), "https://www.amazon.com/Soporte-Celular-Aluminio/dp/B0X");
    expect(p.bloqueado).toBe(true);
    expect(p.tienda).toBe("Amazon");
    expect(p.title).toBe("Soporte Celular Aluminio");
  });
  it("la página de «no encontrado» no es una verificación", () => {
    expect(paginaBloqueada(fx("amazon-no-encontrado.html"), "https://www.amazon.com/dp/B0C1H26C46")).toBe(false);
  });
});

describe("otras tiendas", () => {
  it("Falabella: JSON-LD en pesos y título sin la tienda", () => {
    const p = fromHtml(fx("falabella-monitor.html"), "https://www.falabella.com.co/falabella-co/product/153991322/monitor-gamer/153991323");
    expect(p.currency).toBe("COP");
    expect(p.price).toBe(729_900);
    expect(p.title).not.toMatch(/Falabella/);
    expect(p.image).toMatch(/falabella/);
  });
  it("Éxito detrás de Cloudflare: bloqueado", () => {
    const p = fromHtml(fx("exito-bloqueado.html"), "https://www.exito.com/televisor-samsung-55-pulgadas-crystal-uhd-102938847-mp/p");
    expect(p.bloqueado).toBe(true);
    expect(p.tienda).toBe("Éxito");
    expect(p.title).toMatch(/^Televisor samsung 55 pulgadas/);
  });
  it("Mercado Libre pide verificar la cuenta: bloqueado, con el nombre del enlace", () => {
    const p = fromHtml(fx("mercadolibre-verificacion.html"), "https://www.mercadolibre.com.co/gz/account-verification?go=https%3A%2F%2Farticulo.mercadolibre.com.co%2FMCO-1366356575-audifonos-inalambricos-_JM");
    expect(p.bloqueado).toBe(true);
    expect(p.title).toBe("Audifonos inalambricos");
  });
});

describe("montos, monedas y títulos", () => {
  it("respeta el formato de cada tienda", () => {
    expect(leerMonto("$24.00", "en")).toBe(24);
    expect(leerMonto("1,299.99", "en")).toBe(1299.99);
    expect(leerMonto("COP 195,489", "en")).toBe(195_489);
    expect(leerMonto("$ 1.299.900", "es")).toBe(1_299_900);
    expect(leerMonto("24,99 €", "es")).toBe(24.99);
  });
  it("moneda según el texto y la tienda", () => {
    expect(monedaDe("$24.00", "amazon")).toBe("USD");
    expect(monedaDe("US$24.00", "otra")).toBe("USD");
    expect(monedaDe("COP 53,289.45", "amazon")).toBe("COP");
    expect(monedaDe("$ 99.900", "falabella")).toBe("COP");
    expect(monedaDe("24,99 €", "amazon-es")).toBe("EUR");
  });
  it("prefijos y sufijos de tienda", () => {
    expect(limpiarTitulo("Amazon.com: Soporte de celular : Electrónica", "amazon", "https://www.amazon.com/dp/x")).toBe("Soporte de celular");
    expect(limpiarTitulo("Taladro Bosch | Falabella.com", "falabella", "https://www.falabella.com.co/x")).toBe("Taladro Bosch");
    expect(limpiarTitulo("Nevera Haceb - Éxito", "exito", "https://www.exito.com/x")).toBe("Nevera Haceb");
  });
});
