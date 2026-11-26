/**
 * Palabras clave → categoría. Se comparan sin tildes y en minúsculas, como palabra completa.
 * Las categorías aprendidas (lo que la persona corrige) tienen prioridad sobre estas.
 */

export const CLAVES_GASTO: Record<string, string[]> = {
  Alimentación: [
    "almuerzo", "almorzar", "desayuno", "desayunar", "cena", "comer", "comida", "mercado", "mercar", "restaurante",
    "domicilio", "domicilios", "rappi", "ifood", "cafe", "tinto", "pan", "panaderia", "fruta", "frutas", "super",
    "supermercado", "exito", "d1", "ara", "carulla", "olimpica", "jumbo", "hamburguesa", "pizza", "onces", "empanada",
    "empanadas", "arepa", "helado", "merienda", "almuerzos", "corrientazo", "frisby", "kfc", "crepes", "juan valdez",
  ],
  Transporte: [
    "uber", "didi", "taxi", "bus", "buseta", "transmilenio", "sitp", "metro", "gasolina", "tanqueada", "peaje",
    "peajes", "parqueadero", "cabify", "indriver", "picap", "pasaje", "pasajes", "mototaxi", "soat", "lavada",
  ],
  Vivienda: ["arriendo", "arrendamiento", "administracion", "hipoteca", "renta"],
  Servicios: [
    "luz", "agua", "gas", "internet", "energia", "epm", "claro", "movistar", "tigo", "wom", "codensa", "enel", "vanti",
    "acueducto", "recibo", "recibos", "plan de datos", "plan celular", "telefono", "servicios",
  ],
  Salud: [
    "medico", "drogueria", "farmacia", "eps", "medicamento", "medicamentos", "odontologo", "dentista", "examen",
    "examenes", "terapia", "psicologo", "consulta", "cruz verde", "colsubsidio", "prepagada", "vacuna",
  ],
  Gimnasio: ["gym", "gimnasio", "smartfit", "bodytech", "crossfit", "entrenador", "spinning", "yoga", "pilates"],
  Entretenimiento: [
    "cine", "concierto", "fiesta", "bar", "cerveza", "cervezas", "rumba", "juego", "videojuego", "teatro", "boletas",
    "boleta", "entrada", "entradas", "trago", "tragos", "discoteca", "bolos", "museo", "parque",
  ],
  Apuestas: ["apuesta", "apuestas", "betplay", "wplay", "loteria", "chance", "casino", "rushbet"],
  "Compras personales": [
    "ropa", "zapatos", "tenis", "camisa", "camiseta", "pantalon", "jean", "jeans", "vestido", "chaqueta", "maquillaje",
    "perfume", "peluqueria", "barberia", "corte de pelo", "manicure", "falabella", "zara", "regalo",
  ],
  Tecnología: ["computador", "portatil", "audifonos", "cargador", "mouse", "teclado", "monitor", "tablet", "ipad", "iphone", "software", "app"],
  Suscripciones: [
    "netflix", "spotify", "disney", "hbo", "max", "prime", "youtube", "icloud", "chatgpt", "claude", "suscripcion",
    "deezer", "crunchyroll", "paramount", "canva", "adobe", "figma", "notion", "google one",
  ],
  Familia: ["mama", "papa", "hijo", "hija", "hijos", "colegio", "pension", "abuela", "abuelo", "hermano", "hermana"],
  "Ayuda a otras personas": ["donacion", "propina", "limosna", "prestamo a", "ayuda"],
  Deudas: ["cuota", "credito", "prestamo", "tarjeta de credito", "abono", "intereses"],
};

export const CLAVES_INGRESO: Record<string, string[]> = {
  Salario: ["salario", "sueldo", "nomina", "quincena", "prima", "cesantias", "vacaciones"],
  Freelance: ["freelance", "cliente", "factura", "honorarios", "asesoria", "consultoria"],
  "Diseño y proyectos": ["diseno", "proyecto", "logo", "landing", "pagina", "web", "branding"],
  Negocios: ["venta", "ventas", "vendi", "negocio", "tienda", "pedido", "pedidos"],
};

export const CLAVES_DESEO: Record<string, string[]> = {
  Tecnología: [
    "audifonos", "celular", "iphone", "computador", "portatil", "tablet", "ipad", "monitor", "teclado", "mouse",
    "consola", "playstation", "xbox", "nintendo", "camara", "reloj", "smartwatch", "parlante", "airpods", "macbook",
  ],
  Ropa: ["ropa", "zapatos", "tenis", "camisa", "chaqueta", "jean", "vestido", "buzo", "gorra"],
  Accesorios: ["gafas", "maleta", "morral", "billetera", "bolso", "anillo", "collar", "pulsera"],
  Hogar: ["lampara", "sofa", "cama", "colchon", "silla", "escritorio", "mesa", "nevera", "lavadora", "cafetera", "planta", "cuadro"],
  Experiencias: ["concierto", "cena", "spa", "festival", "clase", "curso de cocina"],
  Viajes: ["viaje", "vuelo", "tiquete", "tiquetes", "hotel", "cartagena", "santa marta", "europa", "playa"],
  Educación: ["curso", "libro", "libros", "diplomado", "maestria", "certificacion"],
};

/** Categoría por palabras clave (texto ya normalizado). Devuelve la primera que aparezca. */
export function categoriaPorClaves(normalizado: string, tabla: Record<string, string[]>, disponibles?: string[]): string | null {
  let mejor: { cat: string; pos: number } | null = null;
  for (const [cat, claves] of Object.entries(tabla)) {
    if (disponibles && !disponibles.includes(cat)) continue;
    for (const k of claves) {
      const m = new RegExp(`(?:^|[^a-z0-9])${k.replace(/ /g, "\\s+")}(?![a-z0-9])`).exec(normalizado);
      if (m && (!mejor || m.index < mejor.pos)) mejor = { cat, pos: m.index };
    }
  }
  return mejor?.cat ?? null;
}
