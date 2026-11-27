# Prompts de Higgsfield · asistentes v2 (Fases 4A y 5.4)

El MCP de Higgsfield conectado en este proyecto no tiene herramientas para generar imágenes
(solo saldo, modelos e historial), así que las hojas las generas tú con estos prompts.

## Cómo generarlas

1. Modelo: `gpt_image_2_6` · proporción `3:2`.
2. Referencias para cada hoja:
   - **Primera referencia (diseño exacto):** `docs/asistentes/v2/{id}-base.png` (el SVG actual renderizado).
   - **Segunda referencia (solo expresividad y poses):** `docs/referencias/duolingo-4-stickers.jpg` (o `duolingo-5-stickers.jpg`). No para copiar el personaje.
3. **Empieza solo con Centavo** (sus 5 hojas) y compártelas antes de seguir con los otros.
4. Guarda cada hoja en `docs/asistentes/v2/{id}/` con el nombre indicado y anota prompt, `job_id` y fecha en `docs/asistentes/v2/registro.md`.

Las hojas son **referencia**: nunca se usan como imagen en la app. Los momentos se construyen en
SVG a partir del dibujo actual; si una hoja se aparta del diseño, manda el SVG.

---

## Centavo (centavo)

### Hoja de giro · `centavo/giro.png`
```
Turnaround sheet of ONE original mascot character: the hamster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Same neutral pose in 5 views side by side: front, three-quarter left, profile left, back, three-quarter right. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body warm yellow #FFD84D with darker yellow shade #E8B820, cheeks and belly pale yellow #FFF1B8, feet sand #E8DFCC. Signature prop: a gold coin with a four-point star, held against the belly.
```

### Hoja de momentos 1–10 · `centavo/momentos-1.png`
```
Expression sheet of ONE original mascot character: the hamster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body warm yellow #FFD84D with darker yellow shade #E8B820, cheeks and belly pale yellow #FFF1B8, feet sand #E8DFCC. Signature prop: a gold coin with a four-point star, held against the belly.
Poses: 1 base — three-quarter view, its own attitude, signature prop; 2 greeting — three-quarter, one arm up, winking; 3 happy — three-quarter, eyes closed in happy arcs, bouncing; 4 celebrating — front view, mid-air, body tilted 15°, both arms up, mouth wide open, small sparkles; 5 euphoric — front view, STAR-shaped eyes, huge open mouth, sparkles and confetti; 6 in love — three-quarter, HEART-shaped eyes, hugging a big heart; 7 proud — three-quarter, chest out, half-closed eyes; 8 approving — three-quarter, thumbs up, nodding; 9 surprised — front view, huge eyes, giant O mouth, an exclamation mark drawn as a shape (no text); 10 thinking — three-quarter, hand on chin, looking up to the side, small thought cloud.
```

### Hoja de momentos 11–20 · `centavo/momentos-2.png`
```
Expression sheet of ONE original mascot character: the hamster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body warm yellow #FFD84D with darker yellow shade #E8B820, cheeks and belly pale yellow #FFF1B8, feet sand #E8DFCC. Signature prop: a gold coin with a four-point star, held against the belly.
Poses: 11 pointing — profile view, arm fully extended pointing forward; 12 worried — three-quarter, sweat drop, hands together, eyebrows up; 13 sad — front view, shrunken and lower, shiny teary eyes, tears; 14 annoyed — half back view looking over the shoulder, arms crossed, frown, steam puffs; 15 asleep — lying on its side, eyes closed, zzz drawn as shapes; 16 bored — three-quarter, leaning, droopy eyelids, side glance; 17 peeking — only head and hands peeking over the edge of a card; 18 on a streak — profile, moving fast, focused, wearing roller skates, speed lines; 19 working — three-quarter, concentrated, holding a small calculator; 20 goodbye — back view walking away, one hand up.
```

### Hoja de crecimiento (Fase 5) · `centavo/crecimiento.png`
```
Growth sheet of ONE original mascot character: the hamster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. 4 stages side by side, same neutral three-quarter pose, the FIRST stage must be identical to the reference. The character never shrinks or changes proportions: growth only ADDS details on top. Stages: 1 initial (exactly the reference); 2 grows (first detail); 3 expert (full detail plus one extra); 4 king (its own crown). Growth trait: a single coin → a small stack of coins beside him → a piggy bank beside him. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body warm yellow #FFD84D with darker yellow shade #E8B820, cheeks and belly pale yellow #FFF1B8, feet sand #E8DFCC.
```

### Hoja del trono (Fase 5) · `centavo/trono.png`
```
Throne sheet of ONE original mascot character: the hamster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Seated like a king on an original themed throne made of stacked gold coins and gold bars, tall backrest shaped like a fan of banknotes, majestic tall pointed backrest, steps in front, regal seated pose, no swords, not based on any film or TV throne. 4 moments side by side: resting with authority (one leg crossed or arms on the armrests), royal wave, proud, sad on its throne. Its own small crown. Plain white background, no text. Same flat two-tone vector style, no outlines, gold details in #FFD84D. Colors: body warm yellow #FFD84D with darker yellow shade #E8B820, cheeks and belly pale yellow #FFF1B8, feet sand #E8DFCC.
```

---

## Brote (brote)

### Hoja de giro · `brote/giro.png`
```
Turnaround sheet of ONE original mascot character: the turtle from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Same neutral pose in 5 views side by side: front, three-quarter left, profile left, back, three-quarter right. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body soft mint #CFF5CF with shade #A9E5A9, belly cream #FBF8EC, shell bright green #5CE65C with darker green shade, feet sand. Signature prop: a small green sprout with two leaves growing from the shell.
```

### Hoja de momentos 1–10 · `brote/momentos-1.png`
```
Expression sheet of ONE original mascot character: the turtle from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body soft mint #CFF5CF with shade #A9E5A9, belly cream #FBF8EC, shell bright green #5CE65C with darker green shade, feet sand. Signature prop: a small green sprout with two leaves growing from the shell.
Poses: 1 base — three-quarter view, its own attitude, signature prop; 2 greeting — three-quarter, one arm up, winking; 3 happy — three-quarter, eyes closed in happy arcs, bouncing; 4 celebrating — front view, mid-air, body tilted 15°, both arms up, mouth wide open, small sparkles; 5 euphoric — front view, STAR-shaped eyes, huge open mouth, sparkles and confetti; 6 in love — three-quarter, HEART-shaped eyes, hugging a big heart; 7 proud — three-quarter, chest out, half-closed eyes; 8 approving — three-quarter, thumbs up, nodding; 9 surprised — front view, huge eyes, giant O mouth, an exclamation mark drawn as a shape (no text); 10 thinking — three-quarter, hand on chin, looking up to the side, small thought cloud.
```

### Hoja de momentos 11–20 · `brote/momentos-2.png`
```
Expression sheet of ONE original mascot character: the turtle from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body soft mint #CFF5CF with shade #A9E5A9, belly cream #FBF8EC, shell bright green #5CE65C with darker green shade, feet sand. Signature prop: a small green sprout with two leaves growing from the shell.
Poses: 11 pointing — profile view, arm fully extended pointing forward; 12 worried — three-quarter, sweat drop, hands together, eyebrows up; 13 sad — front view, shrunken and lower, shiny teary eyes, tears; 14 annoyed — half back view looking over the shoulder, arms crossed, frown, steam puffs; 15 asleep — lying on its side, eyes closed, zzz drawn as shapes; 16 bored — three-quarter, leaning, droopy eyelids, side glance; 17 peeking — only head and hands peeking over the edge of a card; 18 on a streak — profile, moving fast, focused, wearing roller skates, speed lines; 19 working — three-quarter, concentrated, holding a watering can; 20 goodbye — back view walking away, one hand up.
```

### Hoja de crecimiento (Fase 5) · `brote/crecimiento.png`
```
Growth sheet of ONE original mascot character: the turtle from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. 4 stages side by side, same neutral three-quarter pose, the FIRST stage must be identical to the reference. The character never shrinks or changes proportions: growth only ADDS details on top. Stages: 1 initial (exactly the reference); 2 grows (first detail); 3 expert (full detail plus one extra); 4 king (its own crown). Growth trait: sprout with two leaves → small plant → little tree with one flower on the shell. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body soft mint #CFF5CF with shade #A9E5A9, belly cream #FBF8EC, shell bright green #5CE65C with darker green shade, feet sand.
```

### Hoja del trono (Fase 5) · `brote/trono.png`
```
Throne sheet of ONE original mascot character: the turtle from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Seated like a king on an original themed throne made of intertwined roots and tree trunks, with leaves and flowers, majestic tall pointed backrest, steps in front, regal seated pose, no swords, not based on any film or TV throne. 4 moments side by side: resting with authority (one leg crossed or arms on the armrests), royal wave, proud, sad on its throne. Its own small crown. Plain white background, no text. Same flat two-tone vector style, no outlines, gold details in #FFD84D. Colors: body soft mint #CFF5CF with shade #A9E5A9, belly cream #FBF8EC, shell bright green #5CE65C with darker green shade, feet sand.
```

---

## Tuerca (tuerca)

### Hoja de giro · `tuerca/giro.png`
```
Turnaround sheet of ONE original mascot character: the beaver from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Same neutral pose in 5 views side by side: front, three-quarter left, profile left, back, three-quarter right. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body sand #E8DFCC with shade #CFC2A6, belly cream #FBF8EC, flat tail and feet charcoal #2A2A2A, white front teeth. Signature prop: a yellow pencil tucked behind the ear.
```

### Hoja de momentos 1–10 · `tuerca/momentos-1.png`
```
Expression sheet of ONE original mascot character: the beaver from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body sand #E8DFCC with shade #CFC2A6, belly cream #FBF8EC, flat tail and feet charcoal #2A2A2A, white front teeth. Signature prop: a yellow pencil tucked behind the ear.
Poses: 1 base — three-quarter view, its own attitude, signature prop; 2 greeting — three-quarter, one arm up, winking; 3 happy — three-quarter, eyes closed in happy arcs, bouncing; 4 celebrating — front view, mid-air, body tilted 15°, both arms up, mouth wide open, small sparkles; 5 euphoric — front view, STAR-shaped eyes, huge open mouth, sparkles and confetti; 6 in love — three-quarter, HEART-shaped eyes, hugging a big heart; 7 proud — three-quarter, chest out, half-closed eyes; 8 approving — three-quarter, thumbs up, nodding; 9 surprised — front view, huge eyes, giant O mouth, an exclamation mark drawn as a shape (no text); 10 thinking — three-quarter, hand on chin, looking up to the side, small thought cloud.
```

### Hoja de momentos 11–20 · `tuerca/momentos-2.png`
```
Expression sheet of ONE original mascot character: the beaver from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body sand #E8DFCC with shade #CFC2A6, belly cream #FBF8EC, flat tail and feet charcoal #2A2A2A, white front teeth. Signature prop: a yellow pencil tucked behind the ear.
Poses: 11 pointing — profile view, arm fully extended pointing forward; 12 worried — three-quarter, sweat drop, hands together, eyebrows up; 13 sad — front view, shrunken and lower, shiny teary eyes, tears; 14 annoyed — half back view looking over the shoulder, arms crossed, frown, steam puffs; 15 asleep — lying on its side, eyes closed, zzz drawn as shapes; 16 bored — three-quarter, leaning, droopy eyelids, side glance; 17 peeking — only head and hands peeking over the edge of a card; 18 on a streak — profile, moving fast, focused, wearing roller skates, speed lines; 19 working — three-quarter, concentrated, holding a hammer; 20 goodbye — back view walking away, one hand up.
```

### Hoja de crecimiento (Fase 5) · `tuerca/crecimiento.png`
```
Growth sheet of ONE original mascot character: the beaver from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. 4 stages side by side, same neutral three-quarter pose, the FIRST stage must be identical to the reference. The character never shrinks or changes proportions: growth only ADDS details on top. Stages: 1 initial (exactly the reference); 2 grows (first detail); 3 expert (full detail plus one extra); 4 king (its own crown). Growth trait: pencil → tool belt → construction hard hat. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body sand #E8DFCC with shade #CFC2A6, belly cream #FBF8EC, flat tail and feet charcoal #2A2A2A, white front teeth.
```

### Hoja del trono (Fase 5) · `tuerca/trono.png`
```
Throne sheet of ONE original mascot character: the beaver from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Seated like a king on an original themed throne made of wooden planks and beams, crossed tools on the backrest, majestic tall pointed backrest, steps in front, regal seated pose, no swords, not based on any film or TV throne. 4 moments side by side: resting with authority (one leg crossed or arms on the armrests), royal wave, proud, sad on its throne. Its own small crown. Plain white background, no text. Same flat two-tone vector style, no outlines, gold details in #FFD84D. Colors: body sand #E8DFCC with shade #CFC2A6, belly cream #FBF8EC, flat tail and feet charcoal #2A2A2A, white front teeth.
```

---

## Tic (tic)

### Hoja de giro · `tic/giro.png`
```
Turnaround sheet of ONE original mascot character: the rooster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Same neutral pose in 5 views side by side: front, three-quarter left, profile left, back, three-quarter right. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body charcoal #2A2A2A with shade #161616, belly white, comb bright green #5CE65C, yellow beak and feet #FFD84D. Signature prop: a round dark wall clock behind him.
```

### Hoja de momentos 1–10 · `tic/momentos-1.png`
```
Expression sheet of ONE original mascot character: the rooster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body charcoal #2A2A2A with shade #161616, belly white, comb bright green #5CE65C, yellow beak and feet #FFD84D. Signature prop: a round dark wall clock behind him.
Poses: 1 base — three-quarter view, its own attitude, signature prop; 2 greeting — three-quarter, one arm up, winking; 3 happy — three-quarter, eyes closed in happy arcs, bouncing; 4 celebrating — front view, mid-air, body tilted 15°, both arms up, mouth wide open, small sparkles; 5 euphoric — front view, STAR-shaped eyes, huge open mouth, sparkles and confetti; 6 in love — three-quarter, HEART-shaped eyes, hugging a big heart; 7 proud — three-quarter, chest out, half-closed eyes; 8 approving — three-quarter, thumbs up, nodding; 9 surprised — front view, huge eyes, giant O mouth, an exclamation mark drawn as a shape (no text); 10 thinking — three-quarter, hand on chin, looking up to the side, small thought cloud.
```

### Hoja de momentos 11–20 · `tic/momentos-2.png`
```
Expression sheet of ONE original mascot character: the rooster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body charcoal #2A2A2A with shade #161616, belly white, comb bright green #5CE65C, yellow beak and feet #FFD84D. Signature prop: a round dark wall clock behind him.
Poses: 11 pointing — profile view, arm fully extended pointing forward; 12 worried — three-quarter, sweat drop, hands together, eyebrows up; 13 sad — front view, shrunken and lower, shiny teary eyes, tears; 14 annoyed — half back view looking over the shoulder, arms crossed, frown, steam puffs; 15 asleep — lying on its side, eyes closed, zzz drawn as shapes; 16 bored — three-quarter, leaning, droopy eyelids, side glance; 17 peeking — only head and hands peeking over the edge of a card; 18 on a streak — profile, moving fast, focused, wearing roller skates, speed lines; 19 working — three-quarter, concentrated, holding an hourglass; 20 goodbye — back view walking away, one hand up.
```

### Hoja de crecimiento (Fase 5) · `tic/crecimiento.png`
```
Growth sheet of ONE original mascot character: the rooster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. 4 stages side by side, same neutral three-quarter pose, the FIRST stage must be identical to the reference. The character never shrinks or changes proportions: growth only ADDS details on top. Stages: 1 initial (exactly the reference); 2 grows (first detail); 3 expert (full detail plus one extra); 4 king (its own crown). Growth trait: comb grows → short tail feathers → full tail feathers. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body charcoal #2A2A2A with shade #161616, belly white, comb bright green #5CE65C, yellow beak and feet #FFD84D.
```

### Hoja del trono (Fase 5) · `tic/trono.png`
```
Throne sheet of ONE original mascot character: the rooster from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Seated like a king on an original themed throne made of gears and clock pendulums, a big clock face on the backrest, majestic tall pointed backrest, steps in front, regal seated pose, no swords, not based on any film or TV throne. 4 moments side by side: resting with authority (one leg crossed or arms on the armrests), royal wave, proud, sad on its throne. Its own small crown. Plain white background, no text. Same flat two-tone vector style, no outlines, gold details in #FFD84D. Colors: body charcoal #2A2A2A with shade #161616, belly white, comb bright green #5CE65C, yellow beak and feet #FFD84D.
```

---

## Cima (cima)

### Hoja de giro · `cima/giro.png`
```
Turnaround sheet of ONE original mascot character: the mountain goat from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Same neutral pose in 5 views side by side: front, three-quarter left, profile left, back, three-quarter right. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body cream #FBF8EC with shade #E2D8C2, white muzzle and beard, horns sand #E8DFCC with darker shade. Signature prop: a green flag on a pole beside her.
```

### Hoja de momentos 1–10 · `cima/momentos-1.png`
```
Expression sheet of ONE original mascot character: the mountain goat from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body cream #FBF8EC with shade #E2D8C2, white muzzle and beard, horns sand #E8DFCC with darker shade. Signature prop: a green flag on a pole beside her.
Poses: 1 base — three-quarter view, its own attitude, signature prop; 2 greeting — three-quarter, one arm up, winking; 3 happy — three-quarter, eyes closed in happy arcs, bouncing; 4 celebrating — front view, mid-air, body tilted 15°, both arms up, mouth wide open, small sparkles; 5 euphoric — front view, STAR-shaped eyes, huge open mouth, sparkles and confetti; 6 in love — three-quarter, HEART-shaped eyes, hugging a big heart; 7 proud — three-quarter, chest out, half-closed eyes; 8 approving — three-quarter, thumbs up, nodding; 9 surprised — front view, huge eyes, giant O mouth, an exclamation mark drawn as a shape (no text); 10 thinking — three-quarter, hand on chin, looking up to the side, small thought cloud.
```

### Hoja de momentos 11–20 · `cima/momentos-2.png`
```
Expression sheet of ONE original mascot character: the mountain goat from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body cream #FBF8EC with shade #E2D8C2, white muzzle and beard, horns sand #E8DFCC with darker shade. Signature prop: a green flag on a pole beside her.
Poses: 11 pointing — profile view, arm fully extended pointing forward; 12 worried — three-quarter, sweat drop, hands together, eyebrows up; 13 sad — front view, shrunken and lower, shiny teary eyes, tears; 14 annoyed — half back view looking over the shoulder, arms crossed, frown, steam puffs; 15 asleep — lying on its side, eyes closed, zzz drawn as shapes; 16 bored — three-quarter, leaning, droopy eyelids, side glance; 17 peeking — only head and hands peeking over the edge of a card; 18 on a streak — profile, moving fast, focused, wearing roller skates, speed lines; 19 working — three-quarter, concentrated, holding a folded map; 20 goodbye — back view walking away, one hand up.
```

### Hoja de crecimiento (Fase 5) · `cima/crecimiento.png`
```
Growth sheet of ONE original mascot character: the mountain goat from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. 4 stages side by side, same neutral three-quarter pose, the FIRST stage must be identical to the reference. The character never shrinks or changes proportions: growth only ADDS details on top. Stages: 1 initial (exactly the reference); 2 grows (first detail); 3 expert (full detail plus one extra); 4 king (its own crown). Growth trait: horns grow longer and curl, the flag gets bigger. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body cream #FBF8EC with shade #E2D8C2, white muzzle and beard, horns sand #E8DFCC with darker shade.
```

### Hoja del trono (Fase 5) · `cima/trono.png`
```
Throne sheet of ONE original mascot character: the mountain goat from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Seated like a king on an original themed throne made of carved mountain rock, the flag planted on top of the backrest, majestic tall pointed backrest, steps in front, regal seated pose, no swords, not based on any film or TV throne. 4 moments side by side: resting with authority (one leg crossed or arms on the armrests), royal wave, proud, sad on its throne. Its own small crown. Plain white background, no text. Same flat two-tone vector style, no outlines, gold details in #FFD84D. Colors: body cream #FBF8EC with shade #E2D8C2, white muzzle and beard, horns sand #E8DFCC with darker shade.
```

---

## Antojo (antojo)

### Hoja de giro · `antojo/giro.png`
```
Turnaround sheet of ONE original mascot character: the raccoon from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Same neutral pose in 5 views side by side: front, three-quarter left, profile left, back, three-quarter right. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body light gray #E6E6E6 with shade #C7C7C7, belly white, black mask #0A0A0A around the eyes, tail with black rings. Signature prop: a cream paper shopping bag.
```

### Hoja de momentos 1–10 · `antojo/momentos-1.png`
```
Expression sheet of ONE original mascot character: the raccoon from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body light gray #E6E6E6 with shade #C7C7C7, belly white, black mask #0A0A0A around the eyes, tail with black rings. Signature prop: a cream paper shopping bag.
Poses: 1 base — three-quarter view, its own attitude, signature prop; 2 greeting — three-quarter, one arm up, winking; 3 happy — three-quarter, eyes closed in happy arcs, bouncing; 4 celebrating — front view, mid-air, body tilted 15°, both arms up, mouth wide open, small sparkles; 5 euphoric — front view, STAR-shaped eyes, huge open mouth, sparkles and confetti; 6 in love — three-quarter, HEART-shaped eyes, hugging a big heart; 7 proud — three-quarter, chest out, half-closed eyes; 8 approving — three-quarter, thumbs up, nodding; 9 surprised — front view, huge eyes, giant O mouth, an exclamation mark drawn as a shape (no text); 10 thinking — three-quarter, hand on chin, looking up to the side, small thought cloud.
```

### Hoja de momentos 11–20 · `antojo/momentos-2.png`
```
Expression sheet of ONE original mascot character: the raccoon from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Use the second reference image ONLY as a guide for expressiveness and dynamic posing, do not copy that character.
10 full-body poses in a 5x2 grid, plain white background, small flat light-gray ground ellipse under grounded poses, no text, no labels.
Style: modern flat vector mascot, NO outlines, two flat tones per color (base + darker shade), big expressive eyes with white highlights, chunky rounded body, small oval feet. Highly dynamic: most poses are NOT front-facing — use three-quarter views, profile views, back views, tilted bodies, mid-air jumps, leaning and peeking. Exaggerated, readable emotions.
Colors: body light gray #E6E6E6 with shade #C7C7C7, belly white, black mask #0A0A0A around the eyes, tail with black rings. Signature prop: a cream paper shopping bag.
Poses: 11 pointing — profile view, arm fully extended pointing forward; 12 worried — three-quarter, sweat drop, hands together, eyebrows up; 13 sad — front view, shrunken and lower, shiny teary eyes, tears; 14 annoyed — half back view looking over the shoulder, arms crossed, frown, steam puffs; 15 asleep — lying on its side, eyes closed, zzz drawn as shapes; 16 bored — three-quarter, leaning, droopy eyelids, side glance; 17 peeking — only head and hands peeking over the edge of a card; 18 on a streak — profile, moving fast, focused, wearing roller skates, speed lines; 19 working — three-quarter, concentrated, holding a wish list on a clipboard; 20 goodbye — back view walking away, one hand up.
```

### Hoja de crecimiento (Fase 5) · `antojo/crecimiento.png`
```
Growth sheet of ONE original mascot character: the raccoon from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. 4 stages side by side, same neutral three-quarter pose, the FIRST stage must be identical to the reference. The character never shrinks or changes proportions: growth only ADDS details on top. Stages: 1 initial (exactly the reference); 2 grows (first detail); 3 expert (full detail plus one extra); 4 king (its own crown). Growth trait: more rings on the tail → a designer shopping bag → sunglasses on the head. Plain white background, no text. Same flat two-tone vector style, no outlines. Colors: body light gray #E6E6E6 with shade #C7C7C7, belly white, black mask #0A0A0A around the eyes, tail with black rings.
```

### Hoja del trono (Fase 5) · `antojo/trono.png`
```
Throne sheet of ONE original mascot character: the raccoon from the first reference image — keep its EXACT current design: same shapes, proportions, colors, eyes, face style and signature prop. Do not redesign or restyle it in any way. Seated like a king on an original themed throne made of stacked gift boxes and shopping bags, with a velvet cushion, majestic tall pointed backrest, steps in front, regal seated pose, no swords, not based on any film or TV throne. 4 moments side by side: resting with authority (one leg crossed or arms on the armrests), royal wave, proud, sad on its throne. Its own small crown. Plain white background, no text. Same flat two-tone vector style, no outlines, gold details in #FFD84D. Colors: body light gray #E6E6E6 with shade #C7C7C7, belly white, black mask #0A0A0A around the eyes, tail with black rings.
```

