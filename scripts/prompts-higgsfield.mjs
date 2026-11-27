/**
 * Genera docs/asistentes/v2/prompts.md: los prompts de Higgsfield (Fase 4A y 5.4) para cada
 * personaje, con sus colores y accesorio reales. node scripts/prompts-higgsfield.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";

const P = {
  centavo: { nombre: "Centavo", animal: "hamster", colores: "body warm yellow #FFD84D with darker yellow shade #E8B820, cheeks and belly pale yellow #FFF1B8, feet sand #E8DFCC", prop: "a gold coin with a four-point star, held against the belly", herramienta: "a small calculator", crecimiento: "a single coin → a small stack of coins beside him → a piggy bank beside him", trono: "stacked gold coins and gold bars, tall backrest shaped like a fan of banknotes" },
  brote: { nombre: "Brote", animal: "turtle", colores: "body soft mint #CFF5CF with shade #A9E5A9, belly cream #FBF8EC, shell bright green #5CE65C with darker green shade, feet sand", prop: "a small green sprout with two leaves growing from the shell", herramienta: "a watering can", crecimiento: "sprout with two leaves → small plant → little tree with one flower on the shell", trono: "intertwined roots and tree trunks, with leaves and flowers" },
  tuerca: { nombre: "Tuerca", animal: "beaver", colores: "body sand #E8DFCC with shade #CFC2A6, belly cream #FBF8EC, flat tail and feet charcoal #2A2A2A, white front teeth", prop: "a yellow pencil tucked behind the ear", herramienta: "a hammer", crecimiento: "pencil → tool belt → construction hard hat", trono: "wooden planks and beams, crossed tools on the backrest" },
  tic: { nombre: "Tic", animal: "rooster", colores: "body charcoal #2A2A2A with shade #161616, belly white, comb bright green #5CE65C, yellow beak and feet #FFD84D", prop: "a round dark wall clock behind him", herramienta: "an hourglass", crecimiento: "comb grows → short tail feathers → full tail feathers", trono: "gears and clock pendulums, a big clock face on the backrest" },
  cima: { nombre: "Cima", animal: "mountain goat", colores: "body cream #FBF8EC with shade #E2D8C2, white muzzle and beard, horns sand #E8DFCC with darker shade", prop: "a green flag on a pole beside her", herramienta: "a folded map", crecimiento: "horns grow longer and curl, the flag gets bigger", trono: "carved mountain rock, the flag planted on top of the backrest" },
  antojo: { nombre: "Antojo", animal: "raccoon", colores: "body light gray #E6E6E6 with shade #C7C7C7, belly white, black mask #0A0A0A around the eyes, tail with black rings", prop: "a cream paper shopping bag", herramienta: "a wish list on a clipboard", crecimiento: "more rings on the tail → a designer shopping bag → sunglasses on the head", trono: "stacked gift boxes and shopping bags, with a velvet cushion" },
};

const M1 = [
  "1 base — three-quarter view, its own attitude, signature prop",
  "2 greeting — three-quarter, one arm up, winking",
  "3 happy — three-quarter, eyes closed in happy arcs, bouncing",
  "4 celebrating — front view, mid-air, body tilted 15°, both arms up, mouth wide open, small sparkles",
  "5 euphoric — front view, STAR-shaped eyes, huge open mouth, sparkles and confetti",
  "6 in love — three-quarter, HEART-shaped eyes, hugging a big heart",
  "7 proud — three-quarter, chest out, half-closed eyes",
  "8 approving — three-quarter, thumbs up, nodding",
  "9 surprised — front view, huge eyes, giant O mouth, an exclamation mark drawn as a shape (no text)",
  "10 thinking — three-quarter, hand on chin, looking up to the side, small thought cloud",
];
const M2 = [
  "11 pointing — profile view, arm fully extended pointing forward",
  "12 worried — three-quarter, sweat drop, hands together, eyebrows up",
  "13 sad — front view, shrunken and lower, shiny teary eyes, tears",
  "14 annoyed — half back view looking over the shoulder, arms crossed, frown, steam puffs",
  "15 asleep — lying on its side, eyes closed, zzz drawn as shapes",
  "16 bored — three-quarter, leaning, droopy eyelids, side glance",
  "17 peeking — only head and hands peeking over the edge of a card",
  "18 on a streak — profile, moving fast, focused, wearing roller skates, speed lines",
  "19 working — three-quarter, concentrated, holding TOOL",
  "20 goodbye — back view walking away, one hand up",
];

const estilo =
  "Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.";

let md = `# Prompts de Higgsfield · asistentes v2 (Fases 4A y 5.4)

El MCP de Higgsfield conectado en este proyecto no tiene herramientas para generar imágenes
(solo saldo, modelos e historial), así que las hojas las generas tú con estos prompts.

## Cómo generarlas

1. Modelo: \`gpt_image_2_6\` · proporción \`3:2\`.
2. Referencias para cada hoja:
   - **Primera referencia (diseño exacto):** \`docs/asistentes/v2/{id}-base.png\` (el SVG actual renderizado).
   - **Segunda referencia (solo expresividad y poses):** \`docs/referencias/duolingo-4-stickers.jpg\` (o \`duolingo-5-stickers.jpg\`). No para copiar el personaje.
3. **Empieza solo con Centavo** (sus 5 hojas) y compártelas antes de seguir con los otros.
4. Guarda cada hoja en \`docs/asistentes/v2/{id}/\` con el nombre indicado y anota prompt, \`job_id\` y fecha en \`docs/asistentes/v2/registro.md\`.

Las hojas son **referencia**: nunca se usan como imagen en la app. Los momentos se construyen en
SVG a partir del dibujo actual; si una hoja se aparta del diseño, manda el SVG.

`;

for (const [id, p] of Object.entries(P)) {
  const comun = `the ${p.animal} from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way.`;
  md += `---

## ${p.nombre} (${id})

### Hoja de giro · \`${id}/giro.png\`
\`\`\`
Turnaround sheet of ONE original mascot character: ${comun} Same neutral pose in 5 views side by side: front, three-quarter left, profile left, back, three-quarter right. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: ${p.colores}. Signature prop: ${p.prop}.
\`\`\`

### Hoja de momentos 1–10 · \`${id}/momentos-1.png\`
\`\`\`
Expression sheet of ONE original mascot character: ${comun} Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
${estilo}
Colors: ${p.colores}. Signature prop: ${p.prop}.
Poses: ${M1.join("; ")}.
\`\`\`

### Hoja de momentos 11–20 · \`${id}/momentos-2.png\`
\`\`\`
Expression sheet of ONE original mascot character: ${comun} Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
${estilo}
Colors: ${p.colores}. Signature prop: ${p.prop}.
Poses: ${M2.map((m) => m.replace("TOOL", p.herramienta)).join("; ")}.
\`\`\`

### Hoja de crecimiento (Fase 5) · \`${id}/crecimiento.png\`
\`\`\`
Growth sheet of ONE original mascot character: ${comun} 4 stages side by side, same neutral three-quarter pose, the FIRST stage must be identical to the reference. The character never shrinks or changes proportions: growth only ADDS details on top. Stages: 1 initial (exactly the reference); 2 grows (first detail); 3 expert (full detail plus one extra); 4 king (its own crown). Growth trait: ${p.crecimiento}. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: ${p.colores}.
\`\`\`

### Hoja del trono (Fase 5) · \`${id}/trono.png\`
\`\`\`
Throne sheet of ONE original mascot character: ${comun} Seated like a king on an original themed throne made of ${p.trono}, majestic tall pointed backrest, steps in front, regal seated pose, no swords, not based on any film or TV throne. 4 moments side by side: resting with authority (one leg crossed or arms on the armrests), royal wave, proud, sad on its throne. Its own small crown. Plain white background, no text. Same flat two-tone vector style, no outlines, gold details in #FFD84D. Colors: ${p.colores}.
\`\`\`

`;
}

mkdirSync("docs/asistentes/v2", { recursive: true });
writeFileSync("docs/asistentes/v2/prompts.md", md);
writeFileSync(
  "docs/asistentes/v2/registro.md",
  `# Registro de generaciones (Higgsfield)\n\n| Fecha | Personaje | Hoja | job_id | Prompt (sección de prompts.md) | Aprobada |\n|---|---|---|---|---|---|\n`,
);
console.log("listo: docs/asistentes/v2/prompts.md");
