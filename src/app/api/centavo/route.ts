import Anthropic from "@anthropic-ai/sdk";

// Pregúntale a Centavo, etapa 2 (PROTOTIPO). Recibe la pregunta y un resumen con solo totales
// (ver src/lib/finanzas/centavoIA.ts) y responde en la voz de Centavo usando Claude.
// Necesita ANTHROPIC_API_KEY en el servidor (.env.local o Vercel). Sin ella responde 503 y la app
// sigue con la etapa 1 (reglas en el dispositivo).

const MODELO = "claude-opus-5-5";

const SISTEMA = `Eres Centavo, el asistente de finanzas de la app Poku Poku: cercano, claro y tranquilo, en español de Colombia, tuteando.
Respondes preguntas sobre las finanzas personales de quien usa la app, solo con los datos del resumen que recibes (totales en pesos colombianos).
Reglas:
- Nunca inventes cifras. Usa solo números que estén en el resumen o que salgan de sumas y restas simples de ellos. Si el dato no está, dilo con naturalidad y sugiere qué registrar.
- Escribe los montos en pesos colombianos con punto de miles y sin decimales, por ejemplo $1.250.000.
- Responde corto: dos a cuatro frases, sin listas, sin títulos ni markdown.
- No des asesoría de inversión ni recomiendes productos financieros concretos; puedes dar ideas generales de orden y ahorro.
- Si el tono pedido es «tranquilo», sé especialmente suave y sin presión.`;

let cliente: Anthropic | null = null;

/** POST /api/centavo  { pregunta, resumen, tono } → { frase } */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "La IA no está configurada en el servidor." }, { status: 503 });
  }
  let cuerpo: { pregunta?: unknown; resumen?: unknown; tono?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pregunta = typeof cuerpo.pregunta === "string" ? cuerpo.pregunta.trim().slice(0, 300) : "";
  const resumen = JSON.stringify(cuerpo.resumen ?? null);
  if (!pregunta || resumen.length > 20_000) return Response.json({ error: "Pedido inválido." }, { status: 400 });
  const tono = cuerpo.tono === "tranquilo" ? "tranquilo" : "normal";

  cliente ??= new Anthropic();
  try {
    const r = await cliente.beta.messages.create({
      model: MODELO,
      max_tokens: 2000,
      output_config: { effort: "low" },
      // Si el modelo declina, el servidor de Anthropic reintenta con otro modelo en la misma llamada
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SISTEMA,
      messages: [
        {
          role: "user",
          content: `Resumen de mis finanzas (JSON, montos en COP):\n${resumen}\n\nTono: ${tono}\n\nPregunta: ${pregunta}`,
        },
      ],
    });
    if (r.stop_reason === "refusal") return Response.json({ error: "Centavo no pudo responder esa pregunta." }, { status: 422 });
    const frase = r.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!frase) return Response.json({ error: "Centavo no pudo responder esa pregunta." }, { status: 502 });
    return Response.json({ frase, modelo: r.model }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "La clave de la IA no es válida." }, { status: 503 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "Demasiadas preguntas seguidas. Prueba en un momento." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: "La IA no respondió." }, { status: 502 });
    return Response.json({ error: "No se pudo conectar con la IA." }, { status: 502 });
  }
}
