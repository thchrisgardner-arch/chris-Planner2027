/**
 * Poku Poku para Windows (Electron).
 * Abre la app publicada en Vercel en su propia ventana: ícono propio, menú Inicio, acceso directo
 * en el escritorio y una sola instancia. Recuerda el tamaño y la posición de la ventana.
 * Los enlaces externos (Meet, Zoom, sitios) se abren en el navegador predeterminado.
 */
const { app, BrowserWindow, shell, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const URL_APP = "https://chris-planner2027.vercel.app";
const ORIGEN = new URL(URL_APP).origin;

app.setAppUserModelId("co.lifeforlife.app");
// La app se llamaba «LIFE for LIFE»: la carpeta de datos (sesión, datos locales, ventana) se conserva
// con ese nombre para que el cambio a «Poku Poku» no deje a nadie sin sus datos.
app.setPath("userData", path.join(app.getPath("appData"), "LIFE for LIFE"));

// Una sola ventana: si se abre otra vez, se enfoca la existente
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let ventana = null;
const archivoVentana = () => path.join(app.getPath("userData"), "ventana.json");

function leerTamano() {
  try {
    return JSON.parse(fs.readFileSync(archivoVentana(), "utf8"));
  } catch {
    return { width: 1320, height: 860 };
  }
}
function guardarTamano() {
  if (!ventana || ventana.isMinimized()) return;
  try {
    fs.writeFileSync(archivoVentana(), JSON.stringify({ ...ventana.getNormalBounds(), maximizada: ventana.isMaximized() }));
  } catch {
    /* sin permiso de escritura: se usa el tamaño por defecto */
  }
}

function crearVentana() {
  const t = leerTamano();
  ventana = new BrowserWindow({
    x: t.x,
    y: t.y,
    width: t.width,
    height: t.height,
    minWidth: 380,
    minHeight: 560,
    title: "Poku Poku",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#f4f4f2",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  ventana.setMenuBarVisibility(false);
  if (t.maximizada) ventana.maximize();
  ventana.once("ready-to-show", () => ventana.show());
  ventana.on("close", guardarTamano);

  // Enlaces a otros sitios: al navegador del sistema
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ORIGEN)) {
      void shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  ventana.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGEN) && !url.startsWith("file:")) {
      e.preventDefault();
      void shell.openExternal(url);
    }
  });

  // Sin internet: pantalla propia con botón para reintentar
  ventana.webContents.on("did-fail-load", (_e, codigo, _desc, url, principal) => {
    if (!principal || codigo === -3) return; // -3: navegación cancelada (normal)
    void ventana.loadFile(path.join(__dirname, "sin-conexion.html"), { query: { volver: url || URL_APP } });
  });

  // Atajos: Ctrl+R / F5 recargan, F11 pantalla completa
  ventana.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if ((input.control && input.key.toLowerCase() === "r") || input.key === "F5") {
      ventana.webContents.reload();
      e.preventDefault();
    }
    if (input.key === "F11") {
      ventana.setFullScreen(!ventana.isFullScreen());
      e.preventDefault();
    }
  });

  void ventana.loadURL(URL_APP);
}

app.on("second-instance", () => {
  if (!ventana) return;
  if (ventana.isMinimized()) ventana.restore();
  ventana.focus();
});

app.whenReady().then(() => {
  // Permisos solo para la app: micrófono (notas de voz), notificaciones y portapapeles
  const permitidos = new Set(["media", "notifications", "clipboard-sanitized-write", "fullscreen"]);
  session.defaultSession.setPermissionRequestHandler((wc, permiso, responder) => {
    const desde = wc.getURL();
    responder(permitidos.has(permiso) && desde.startsWith(ORIGEN));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permiso, origen) => permitidos.has(permiso) && (origen || "").startsWith(ORIGEN));

  crearVentana();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on("window-all-closed", () => app.quit());
