# Folio — Especificación y arquitectura

> Documento para entender (y poder explicar) qué hace Folio, cómo está construido y por qué.
> Escrito en estilo *spec-driven development*: primero **qué** debe hacer el sistema (requisitos),
> después **cómo** lo hace (arquitectura, contratos, flujos) y por último **cómo se comprueba** (tests).

---

## 0. Resumen en 30 segundos

Folio es una **app personal** para el iPhone y el PC que permite **escanear documentos con la cámara,
firmarlos y editar PDFs** (unir, dividir, comprimir, OCR, convertir, proteger…), al estilo de iLovePDF.

- Es una **PWA** (una web que se instala en el iPhone como si fuera una app).
- Casi todo se hace **dentro del navegador**: el archivo no sale del móvil.
- Lo que el navegador no puede hacer (OCR, comprimir, convertir Word) lo hace un **servidor en el PC**
  (Python + FastAPI), pensado para ejecutarse en **Docker**.

```
 iPhone / PC (navegador)                         PC de casa
┌─────────────────────────────┐   HTTPS / LAN   ┌──────────────────────────────┐
│ PWA React (web/)            │ ──────────────▶ │ FastAPI (server/)            │
│  · pdf-lib  (modificar PDF) │  POST /api/...  │  · pikepdf, pdf2docx         │
│  · pdf.js   (dibujar PDF)   │ ◀────────────── │  · Ghostscript, OCRmyPDF,    │
│  · OpenCV   (escáner)       │   archivo       │    LibreOffice (en Docker)   │
└─────────────────────────────┘                 └──────────────────────────────┘
```

---

## 1. Requisitos (el «qué»)

### 1.1 Funcionales

| ID | Requisito | Dónde se cumple |
|---|---|---|
| F1 | Escanear varias páginas con la cámara, detectar bordes, enderezar y aplicar filtro (color / grises / B/N) y generar un PDF | `web/src/scan/` |
| F2 | Firmar un PDF con firma manuscrita (dibujada), guardarla y colocarla/redimensionarla sobre la página | `web/src/sign/` |
| F3 | Unir, dividir y organizar páginas (reordenar, rotar, borrar, duplicar) | `web/src/pages/` + `lib/pdfOps.ts` |
| F4 | Imágenes → PDF y PDF → imágenes | `pages/ImagesToPdfPage.tsx`, `pages/PdfToImagesPage.tsx` |
| F5 | Marca de agua y numeración de páginas con vista previa fiel | `lib/textMarks.ts` + `ui/MarkPreview.tsx` |
| F6 | Añadir texto, fecha, ✓/✗, resaltar, tapar y dibujar a mano, con deshacer | `web/src/annotate/` |
| F7 | Comprimir, OCR, reparar, Office → PDF, PDF → Word, proteger y desbloquear | `server/app/tools.py` + `pages/ServerToolPage.tsx` |
| F8 | Compartir el resultado (hoja de compartir de iOS) o descargarlo; varios archivos → ZIP | `ui/ExportView.tsx`, `lib/share.ts` |

### 1.2 No funcionales

| ID | Requisito | Cómo se cumple |
|---|---|---|
| NF1 | **Privacidad**: si se puede, el archivo no sale del dispositivo | Herramientas `where: 'local'` en `tools.ts` |
| NF2 | **Diseño estilo Apple**: limpio, premium, minimalista, modo claro/oscuro | Tokens CSS en `index.css`, componentes de `ui/` |
| NF3 | **Memoria del iPhone**: Safari mata la pestaña si se pasa de memoria | Renderizado perezoso, límites de canvas, JPEG en lugar de canvas (ver §6.2) |
| NF4 | **Seguridad**: validar entradas, sin filtrar detalles internos | Límites de tamaño, contraseñas acotadas, `UserError` / `ToolError` (ver §6.3) |
| NF5 | **Errores**: nada falla en silencio; mensajes claros en español | `useTask`, `ErrorBoundary`, timeouts (ver §6.1) |
| NF6 | **HTTPS**: Safari solo deja usar la cámara en contexto seguro | `@vitejs/plugin-basic-ssl` en desarrollo |

### 1.3 Fuera de alcance (decidido)

- Editar el texto que **ya existe** dentro de un PDF.
- Firma digital con certificado (solo manuscrita).
- Varios usuarios / cuentas / login. La API **no tiene autenticación**: solo para la red de casa.
- «Tapar» **no** es una redacción segura: el texto sigue dentro del PDF (la app lo avisa).

---

## 2. Tecnologías y por qué se eligió cada una

### Frontend (`web/`)

| Tecnología | Para qué | Por qué esta |
|---|---|---|
| **React 19** | Interfaz por componentes | Estándar, mucha documentación |
| **TypeScript** (estricto) | Tipos en todo el código | Detecta errores antes de ejecutar |
| **Vite** | Servidor de desarrollo y compilación | Muy rápido; plugins para PWA y HTTPS |
| **vite-plugin-pwa** | Manifest + *service worker* | Permite «Añadir a pantalla de inicio» y uso sin conexión |
| **react-router-dom** | Navegación entre pantallas (`/tool/sign`…) | |
| **pdf-lib** | **Modificar** PDFs (unir, girar, incrustar firmas, texto) | Funciona 100 % en el navegador |
| **pdfjs-dist** (pdf.js, Mozilla) | **Dibujar** PDFs en pantalla (páginas, miniaturas) | Es el visor de Firefox; build `legacy` para Safari |
| **OpenCV.js** | Detectar bordes del documento y corregir perspectiva | Visión por computador; se carga solo al escanear (~15 MB) |
| **fflate** | Crear ZIP al descargar varios archivos | Pequeña y rápida |
| **lucide-react** | Iconos | Trazo fino parecido a SF Symbols de Apple |
| **Vitest** | Tests del frontend | Integrado con Vite |
| **oxlint** | Linter (busca errores y malas prácticas) | Muy rápido |

### Backend (`server/`)

| Tecnología | Para qué |
|---|---|
| **Python + FastAPI** | API HTTP; también sirve la PWA compilada |
| **uvicorn** | Servidor que ejecuta FastAPI |
| **pikepdf** (qpdf) | Proteger / desbloquear (AES‑256), reparar |
| **pdf2docx** | PDF → Word |
| **OCRmyPDF + Tesseract** (español/inglés) | Reconocer texto en PDFs escaneados |
| **Ghostscript** | Comprimir PDFs (y segundo intento de reparación) |
| **LibreOffice headless** | Word / Excel / PowerPoint → PDF |
| **pytest** | Tests del backend |
| **Docker** | Empaqueta Python + Ghostscript + Tesseract + LibreOffice (no existen fácilmente en Windows) |

---

## 3. Arquitectura (el «cómo»)

### 3.1 Decisión principal: dónde se procesa cada cosa

Cada herramienta del catálogo (`web/src/tools.ts`) tiene un campo `where`:

- **`local`** → se procesa en el navegador. Escanear, firmar, unir, dividir, organizar, imágenes↔PDF,
  marca de agua, numerar, añadir texto.
- **`server`** → se envía al PC. Comprimir, OCR, reparar, Office→PDF, PDF→Word, proteger, desbloquear.

Regla: **preferir siempre local**. Solo va al servidor lo que necesita programas que no existen en un navegador.

### 3.2 Mapa de carpetas

```
.
├── CLAUDE.md                 Guía técnica para el asistente de IA (convenciones del proyecto)
├── docs/ARQUITECTURA.md      Este documento
├── package.json              Atajos: npm run dev | api | build | lint | test
├── docker-compose.yml        Arranca el contenedor (puerto 8000)
├── resources/                Logo original y versión vectorial
├── server/
│   ├── Dockerfile            Etapa 1: compila la PWA con Node · Etapa 2: Python + binarios
│   ├── app/main.py           FastAPI: límite de tamaño, /api/health, sirve la PWA
│   ├── app/tools.py          Registro TOOLS y POST /api/tools/{tool}
│   └── tests/                pytest
└── web/
    ├── public/               Iconos de la PWA, logo, wordmark
    └── src/
        ├── main.tsx          Arranque: ErrorBoundary + registro de errores globales
        ├── App.tsx           Inicio (lista de herramientas) + rutas
        ├── tools.ts          Catálogo de herramientas
        ├── api.ts            Cliente del servidor (timeouts, errores)
        ├── index.css         Diseño: tokens de color, tipografía, componentes
        ├── lib/              Lógica pura reutilizable (PDF, geometría, errores, compartir…)
        ├── ui/               Componentes y hooks de interfaz reutilizables
        ├── scan/             Escáner
        ├── sign/             Firma
        ├── annotate/         Añadir texto y anotaciones
        ├── pages/            Herramientas de páginas y de servidor
        └── test/             Utilidades para los tests (PDFs «difíciles»)
```

### 3.3 Capas del frontend

```
 Pantallas (*Page.tsx)      → coordinan estado y eventos del usuario
        │
 Componentes y hooks (ui/)  → presentación reutilizable: NavBar, ExportView, PageThumb, useTask…
        │
 Lógica pura (lib/, *.ts)   → funciones sin React, con tests: pdfOps, textMarks, gestures, splitPlan…
        │
 Librerías                  → pdf-lib, pdf.js, OpenCV.js
```

**Patrón de pantallas**: una pantalla no contiene cálculos; los delega en módulos `.ts` puros
(fáciles de probar) y pinta con componentes. Ejemplo: `AnnotPage.tsx` solo traduce eventos del dedo;
qué pasa con cada gesto lo decide `gestures.ts`, y cómo se dibuja, `AnnotShape.tsx`.

### 3.4 Piezas clave reutilizables

| Pieza | Qué hace |
|---|---|
| `lib/pdfOps.ts` → `buildPdfs` | **Toda** operación de páginas se describe como una lista de `{fuente, página, giro}` por archivo de salida. Unir, dividir, reordenar, rotar y duplicar son la misma función con distinta lista. |
| `lib/pdfjs.ts` | Única puerta a pdf.js: abrir, cerrar (liberar memoria), renderizar, miniaturas en caché. |
| `lib/pageGeometry.ts` → `viewOf` | Convierte coordenadas «como se ve la página» a coordenadas internas del PDF, teniendo en cuenta páginas giradas (/Rotate) y recortadas (CropBox). |
| `lib/textMarks.ts` | Calcula dónde va cada texto (marca de agua, números). **La misma función** alimenta la vista previa y el PDF final → lo que ves es lo que obtienes. |
| `lib/annotations.ts` | Modelo de anotaciones (texto, rectángulo, marca, trazo) y su geometría compartida entre SVG y PDF. |
| `ui/useTask.ts` | Ejecuta tareas largas: muestra el HUD «Procesando…», permite cancelar y gestiona errores. |
| `ui/usePageCanvas.ts` | Dibuja una página solo cuando está cerca de la pantalla y la libera al alejarse. |
| `ui/ExportView.tsx` | Pantalla final común: Compartir / Descargar (+ ZIP si son varios). |
| `ui/useSortable.ts` | Reordenar arrastrando con el dedo (pulsación larga), bloqueando el scroll de iOS. |

---

## 4. Flujos principales

### 4.1 Escanear (`scan/ScanPage.tsx`)

```
Foto (input con capture="environment")
  → loadImageFile   reduce a 3000 px, valida tamaño (≤ 40 MB, ≤ 50 MP)
  → detectDocument  OpenCV encuentra las 4 esquinas (o usa el marco completo)
  → CropEditor      el usuario ajusta las esquinas (con lupa)
  → warpDocument    corrige la perspectiva (página «recta»)
  → filtro + giro   color / grises / blanco y negro
  → JPEG            la página se guarda comprimida, no como canvas (memoria)
  → jpegsToPdf      pdf-lib monta el PDF
  → ExportView      compartir / descargar / «Firmar»
```

### 4.2 Firmar (`sign/`)

```
Abrir PDF → páginas con pdf.js (PageView) → dibujar firma (SignaturePad + ink.ts)
  → se guarda como PNG transparente en localStorage
  → colocar / mover / redimensionar (coordenadas 0–1 de la página vista)
  → stamp.ts incrusta la imagen con pdf-lib (convirtiendo coordenadas, respeta giros)
  → ExportView
```

### 4.3 Herramienta de servidor (p. ej. OCR)

```
ServerToolPage (CONFIGS['ocr'])
  → api.ts runServerTool: POST multipart (file + options JSON), timeout 16 min, cancelable
  → main.py: rechaza si Content-Length > 200 MB (413)
  → tools.py run_tool:
        · ¿existe la herramienta? ¿extensión aceptada? ¿binarios disponibles?
        · semáforo: máx. 2 trabajos a la vez
        · carpeta temporal propia → guardar subida (con límite) → ejecutar con timeout
        · responder el archivo (Content-Disposition + X-Original-Size)
        · borrar la carpeta temporal después de responder
  → ExportView (muestra p. ej. «Reducido un 63 %»)
```

---

## 5. Contratos (interfaces entre piezas)

### 5.1 API HTTP

| Método | Ruta | Entrada | Salida |
|---|---|---|---|
| GET | `/api/health` | — | `{"status":"ok","tools":{"ocr":true,"compress":false,…}}` |
| POST | `/api/tools/{tool}` | `multipart/form-data`: `file`, `options` (JSON de strings) | `200` + archivo · o error `{"detail":"mensaje"}` |

Códigos de error: `400` opciones no válidas · `404` herramienta desconocida · `411` falta tamaño · `413` demasiado grande ·
`415` tipo de archivo no admitido · `422` error explicable al usuario (`ToolError`) · `503` falta un programa (fuera de Docker) · `500` fallo inesperado (mensaje genérico).

`tools` en `/api/health` sirve para que la pantalla de inicio marque **«Docker»** o **«Sin PC»** en las herramientas no disponibles.

### 5.2 Añadir una herramienta de servidor (receta)

1. `server/app/tools.py`: escribir la función `(entrada, carpeta, opciones) -> salida` y añadirla a `TOOLS`
   con extensiones aceptadas, sufijo del nombre y binarios requeridos.
2. Test en `server/tests/test_tools.py`.
3. `web/src/tools.ts`: entrada con `where: 'server'`.
4. `web/src/pages/ServerToolPage.tsx`: entrada en `CONFIGS` (qué acepta, opciones, validación, texto del resultado).

### 5.3 Añadir una herramienta local (receta)

1. Lógica pura en `lib/` o junto a la pantalla (`*.ts`) **con test**.
2. Pantalla `*Page.tsx` que reutilice `OpenPdfEmpty`, `PageThumb`, `useTask`, `ExportView`.
3. Ruta *lazy* en `App.tsx` y entrada en `tools.ts`.

---

## 6. Calidad transversal

### 6.1 Manejo de errores

| Tipo de error | Se lanza como | El usuario ve | Se registra |
|---|---|---|---|
| Entrada no válida (PDF roto, con contraseña, emoji en Helvetica…) | `UserError` (front) / `ToolError` → 422 (servidor) | Mensaje concreto en español | Sí, con el error original en `cause` |
| Fallo técnico inesperado | cualquier `Error` | Mensaje genérico | Sí (`console.error` / log del servidor) |
| Cancelación por el usuario | `AbortError` | Nada | No |
| Servidor no responde a tiempo | timeout de `withTimeout` (`api.ts`) | Aviso de que ha tardado demasiado | Sí |
| Error de React al pintar | — | `ErrorBoundary` en vez de pantalla en blanco | Sí |

Regla: **nada falla en silencio** (no hay `catch {}` vacíos ni promesas sin `.catch`).

### 6.2 Memoria (iPhone)

Safari en iOS cierra la pestaña si usa demasiada memoria. Medidas:
- Páginas renderizadas solo cerca de la pantalla y liberadas al alejarse; densidad ≤ 2×, máx. 12 MP.
- Miniaturas guardadas como JPEG pequeño en caché (no canvases) y liberadas al cerrar el PDF.
- El escáner guarda cada página como JPEG (1–2 MB) en vez de canvas (~36 MB).
- OpenCV: cada `cv.Mat` se libera con `.delete()`; la librería solo se descarga al escanear.
- Canvases temporales liberados con `releaseCanvas`.

### 6.3 Seguridad

- Límite de 200 MB comprobado dos veces (cabecera y al copiar).
- Contraseñas ≤ 128 caracteres; nombres de archivo saneados (`safeFileName`).
- Los errores **nunca repiten** lo que envió el cliente ni muestran rutas o trazas internas (hay tests).
- pdf.js v6 no ejecuta código de las fuentes del PDF (sin `eval`).
- Procesos externos con timeout (5 min; OCR 15 min) y máx. 2 simultáneos.
- Sin autenticación: aceptable solo en la red de casa.

### 6.4 Diseño

Tokens en `index.css` (`--tint`, `--label`, `--surface`, `--c-blue`…), cambian solos con modo oscuro.
Componentes tipo iOS: barra de navegación translúcida, listas agrupadas como Ajustes, controles segmentados,
HUD de carga. Zonas seguras del iPhone (`safe-area-inset`) y objetivos táctiles de 44 px.

---

## 7. Cómo se comprueba (tests)

| Suite | Herramienta | Qué prueba |
|---|---|---|
| Frontend | Vitest (`npm test` en `web/`) | Lógica pura: operaciones de páginas, geometría, marcas de texto, anotaciones, firmas, gestos, deshacer, plan de división, errores, API |
| Servidor | pytest | Cada herramienta, límites de tamaño, contraseñas, que los errores no filtren información |

Principio importante: los tests de PDF usan **pdf-lib y pdf.js reales, sin simulaciones**, y leen el resultado
«como lo vería el usuario». `test/pdfHelpers.ts` define `TRICKY_PAGES`: páginas giradas 90/180/270° y con
recorte desplazado. Todo lo que coloca algo en una página se prueba contra ellas.

Además: `tsc` (tipos), `oxlint` (lint) y `npm run build` deben pasar.
Los componentes React no tienen tests: por eso la lógica se saca a módulos `.ts`.

---

## 8. Cómo arrancarlo

```bash
npm run dev     # PWA en https://<IP-del-PC>:5173 (aceptar el certificado en el iPhone)
npm run api     # API en http://localhost:8000 (Vite le reenvía /api)
npm test        # tests de frontend y servidor
docker compose up --build   # todo junto en el puerto 8000, con OCR/compresión/Office
```

---

## 9. Registro de decisiones

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| PWA | App nativa (Expo / Swift) | Sin Mac ni cuenta de Apple Developer; una sola base de código para iPhone y PC |
| Procesar en el navegador por defecto | Todo en servidor | Privacidad y funciona sin el PC encendido |
| Servidor en Docker | Instalar binarios en Windows | Ghostscript, Tesseract y LibreOffice son fiables en Linux |
| `<input capture>` para la cámara | `getUserMedia` | Más fiable en iOS y usa la cámara nativa |
| Coordenadas «como se ve» la página | Coordenadas internas del PDF | Simplifica la UI; una sola función convierte (y está probada con páginas giradas) |
| Misma función para vista previa y PDF | Dos implementaciones | Garantiza que lo que se ve es lo que se exporta |
| Firma manuscrita | Certificado digital | Uso personal; mucho más simple |

---

## 10. Glosario

- **PWA**: web que se instala y se comporta como una app.
- **Service worker**: script que permite a la PWA funcionar sin conexión y cachear archivos.
- **Canvas**: «lienzo» de píxeles del navegador; ocupa mucha memoria.
- **/Rotate, CropBox**: propiedades de una página PDF (giro y zona visible).
- **OCR**: reconocimiento óptico de caracteres; convierte una imagen de texto en texto seleccionable.
- **Perspectiva / warp**: transformar una foto inclinada en un rectángulo recto.
- **HUD**: aviso flotante de «Procesando…».
- **Semáforo**: contador que limita cuántos trabajos se ejecutan a la vez.
- **Timeout**: tiempo máximo antes de abandonar una operación.
- **Lazy loading**: cargar código solo cuando hace falta.
- **Función pura**: devuelve siempre lo mismo para la misma entrada y no toca nada externo; fácil de probar.
- **Complejidad ciclomática (CC)**: número de caminos distintos en una función; cuanto más alta, más difícil de mantener.
