"use client";

/**
 * Editor de una nota (Tiptap, solo lo necesario): títulos H1–H3, párrafos, listas con viñetas y
 * numeradas, casillas, negrita, cursiva, enlaces y citas. Atajos tipo Markdown («# », «- », «1. »,
 * «[] », «> »). Comando «/»: menú de bloques y de registros reales (/tarea, /evento, /gasto) que se
 * recorre con flechas y Enter. Guardado automático.
 */
import "./editor.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Italic, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Popover } from "@/components/ui/Popover";
import { useToday } from "@/hooks/useToday";
import { COMANDOS, leerComando, type Comando } from "@/lib/proyectos/comandos";
import type { Nodo } from "@/lib/proyectos/documentos";
import { abrirCaptura } from "@/modules/captura/CapturaRapida";
import { formatTime, relativeDay } from "@/utils/dates";
import { formatCOP } from "@/utils/money";
import { cn } from "@/utils/cn";

type Menu = {
  opciones: Comando[];
  resto: string;
  inicio: number;
  fin: number;
  top: number;
  left: number;
  indice: number;
};

const ID_MENU = "menu-comandos";

export function EditorNota({
  contenido,
  proyectoId,
  onCambio,
}: {
  contenido: Nodo;
  proyectoId: string;
  onCambio: (c: Nodo) => void;
}) {
  const today = useToday();
  const caja = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const menuRef = useRef<Menu | null>(null);
  useLayoutEffect(() => {
    menuRef.current = menu;
  }, [menu]);
  /** Línea donde la persona cerró el menú con Escape (no se vuelve a abrir mientras siga el «/») */
  const descartado = useRef<number | null>(null);
  const ejecutarRef = useRef<(c: Comando) => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        a11y: { checkboxLabel: (node, marcada) => `${marcada ? "Desmarcar" : "Marcar"}: ${node.textContent || "casilla"}` },
      }),
      Placeholder.configure({
        placeholder:
          "Escribe, o «/» para insertar un bloque, una tarea, un evento o un gasto",
      }),
    ],
    content: contenido,
    editorProps: {
      attributes: {
        class: "editor-nota focus-ring -mx-2 rounded-[12px] px-2 py-1",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Contenido de la nota",
        "aria-describedby": "ayuda-editor",
        "aria-haspopup": "listbox",
        "aria-autocomplete": "list",
      },
      handleKeyDown: (_view, e) => {
        const m = menuRef.current;
        if (!m) return false;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const n = m.opciones.length;
          setMenu({
            ...m,
            indice: (m.indice + (e.key === "ArrowDown" ? 1 : n - 1)) % n,
          });
          return true;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          ejecutarRef.current(m.opciones[m.indice]);
          return true;
        }
        if (e.key === "Escape") {
          descartado.current = m.inicio;
          setMenu(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onCambio(ed.getJSON() as Nodo);
      calcular(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => calcular(ed),
  });

  /** ¿La línea actual empieza con «/»? Entonces se abre el menú, debajo de la línea */
  function calcular(ed: Editor) {
    const { $from, empty } = ed.state.selection;
    if (!empty || $from.parent.type.name !== "paragraph") return setMenu(null);
    const linea = $from.parent.textBetween(0, $from.parentOffset, "\n", " ");
    if (!linea.startsWith("/")) descartado.current = null;
    const leido = leerComando(linea);
    if (!leido || descartado.current === $from.start() || !caja.current)
      return setMenu(null);
    const c = ed.view.coordsAtPos($from.start());
    const r = caja.current.getBoundingClientRect();
    const previo = menuRef.current;
    setMenu({
      opciones: leido.opciones,
      resto: leido.resto,
      inicio: $from.start(),
      fin: $from.pos,
      top: c.bottom - r.top + 6,
      left: Math.max(0, Math.min(c.left - r.left, r.width - 260)),
      indice:
        previo && previo.opciones.length === leido.opciones.length
          ? Math.min(previo.indice, leido.opciones.length - 1)
          : 0,
    });
  }

  useLayoutEffect(() => {
    ejecutarRef.current = (c: Comando) => {
      const m = menuRef.current;
      if (!editor || !m) return;
      setMenu(null);
      editor.chain().focus().deleteRange({ from: m.inicio, to: m.fin }).run();
      if (c.tipo === "bloque") {
        const ch = editor.chain().focus();
        if (c.id === "h1" || c.id === "h2" || c.id === "h3")
          ch.setHeading({ level: Number(c.id[1]) as 1 | 2 | 3 });
        else if (c.id === "texto") ch.setParagraph();
        else if (c.id === "vinetas") ch.toggleBulletList();
        else if (c.id === "numerada") ch.toggleOrderedList();
        else if (c.id === "casillas") ch.toggleTaskList();
        else ch.toggleBlockquote();
        if (m.resto) ch.insertContent(m.resto);
        ch.run();
        return;
      }
      // Registro real: la línea queda con el texto y se abre la vista previa de la captura rápida
      if (m.resto) editor.chain().focus().insertContent(m.resto).run();
      const inicio = m.inicio;
      abrirCaptura({
        texto: m.resto,
        tipo: c.id,
        proyectoId: c.id === "tarea" ? proyectoId : undefined,
        alGuardar: (r) => {
          const cuando =
            r.fecha && today ? relativeDay(r.fecha, today).toLowerCase() : "";
          const resumen =
            r.tipo === "gasto"
              ? `Gasto registrado: ${r.descripcion}${r.monto ? ` · ${formatCOP(r.monto)}` : ""}`
              : r.tipo === "evento"
                ? `Evento agendado: ${r.descripcion}${cuando ? ` · ${cuando}` : ""}${r.hora ? ` ${formatTime(r.hora)}` : ""}`
                : `Tarea creada: ${r.descripcion}${cuando ? ` · ${cuando}` : ""}`;
          editor
            .chain()
            .command(({ tr }) => {
              const $p = tr.doc.resolve(Math.min(inicio, tr.doc.content.size));
              tr.insertText(resumen, $p.start(), $p.end());
              return true;
            })
            .run();
        },
      });
    };
  });

  // El menú se anuncia y se enlaza con el editor (lector de pantalla)
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    dom.setAttribute("aria-expanded", menu ? "true" : "false");
    if (menu) {
      dom.setAttribute("aria-controls", ID_MENU);
      dom.setAttribute(
        "aria-activedescendant",
        `${ID_MENU}-${menu.opciones[menu.indice].id}`,
      );
    } else {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
    }
  }, [editor, menu]);

  return (
    <div ref={caja} className="relative">
      {editor ? <BarraFormato editor={editor} /> : null}
      <p id="ayuda-editor" className="sr-only">
        Escribe barra para insertar un título, una lista, casillas, una cita,
        una tarea, un evento o un gasto. Muévete con las flechas y elige con
        Enter.
      </p>
      <EditorContent editor={editor} />
      {menu ? (
        <ul
          id={ID_MENU}
          role="listbox"
          aria-label="Insertar"
          className="absolute z-20 max-h-72 w-[260px] overflow-y-auto rounded-[18px] bg-bg p-1 shadow-[0_8px_30px_rgba(0,0,0,0.12),0_0_0_1px_var(--color-line)]"
          style={{ top: menu.top, left: menu.left }}
        >
          {menu.opciones.map((c, i) => (
            <li
              key={c.id}
              id={`${ID_MENU}-${c.id}`}
              role="option"
              aria-selected={i === menu.indice}
              onMouseDown={(e) => {
                e.preventDefault();
                ejecutarRef.current(c);
              }}
              onMouseEnter={() => setMenu({ ...menu, indice: i })}
              className={cn(
                "flex cursor-pointer flex-col rounded-[12px] px-3 py-2",
                i === menu.indice && "bg-card",
              )}
            >
              <span className="text-[13.5px] font-medium">
                {c.label}
                {c.tipo === "registro" && menu.resto ? (
                  <span className="font-normal text-muted">
                    {" "}
                    · {menu.resto}
                  </span>
                ) : null}
              </span>
              <span className="text-[12px] text-muted">{c.ayuda}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {menu
          ? `${menu.opciones.length} ${menu.opciones.length === 1 ? "opción" : "opciones"}. ${COMANDOS.length > 0 ? menu.opciones[menu.indice].label : ""}`
          : ""}
      </span>
    </div>
  );
}

/** Negrita, cursiva y enlace (los bloques van con «/» o atajos tipo Markdown) */
function BarraFormato({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState("");
  const boton = (activo: boolean) => cn("h-8 w-8", activo && "bg-elev");
  return (
    <div
      className="mb-2 flex items-center gap-1"
      role="toolbar"
      aria-label="Formato del texto"
    >
      <Button
        size="icon-sm"
        variant="ghost"
        className={boton(editor.isActive("bold"))}
        aria-label="Negrita"
        aria-pressed={editor.isActive("bold")}
        title="Negrita (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={16} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className={boton(editor.isActive("italic"))}
        aria-label="Cursiva"
        aria-pressed={editor.isActive("italic")}
        title="Cursiva (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={16} />
      </Button>
      <Popover
        side="bottom"
        align="start"
        trigger={({ open, toggle }) => (
          <Button
            size="icon-sm"
            variant="ghost"
            className={boton(editor.isActive("link"))}
            aria-label="Enlace"
            aria-expanded={open}
            aria-pressed={editor.isActive("link")}
            onClick={() => {
              setUrl((editor.getAttributes("link").href as string) ?? "");
              toggle();
            }}
          >
            <Link2 size={16} />
          </Button>
        )}
      >
        {(cerrar: () => void) => (
          <form
            className="flex w-[280px] flex-col gap-2 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              const u = url.trim();
              if (!u)
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
              else
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({
                    href: /^(https?:|mailto:)/i.test(u) ? u : `https://${u}`,
                  })
                  .run();
              cerrar();
            }}
          >
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              aria-label="Dirección del enlace"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              {editor.isActive("link") ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .extendMarkRange("link")
                      .unsetLink()
                      .run();
                    cerrar();
                  }}
                >
                  Quitar
                </Button>
              ) : null}
              <Button type="submit" size="sm" variant="primary">
                Aplicar
              </Button>
            </div>
          </form>
        )}
      </Popover>
    </div>
  );
}
