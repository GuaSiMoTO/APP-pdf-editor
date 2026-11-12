# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**Folio**: app personal (un único usuario) para escanear documentos con el iPhone, firmarlos y editar PDFs con las herramientas típicas de iLovePDF. iLovePDF se usa solo como referencia de funcionalidades/UX: no copiar su código, assets, marca ni usar sus APIs.

Idioma: UI, comentarios y comunicación en español.

## Decisiones de arquitectura (ya tomadas)

- **PWA, no app nativa**: el usuario tiene iPhone + PC Windows (sin Mac ni cuenta Apple Developer). La app se instala desde Safari → "Añadir a pantalla de inicio".
- **HTTPS obligatorio**: Safari iOS solo permite la cámara (`getUserMedia`) en contexto seguro y el iPhone accede al PC por IP de LAN. En desarrollo lo resuelve `@vitejs/plugin-basic-ssl`; en producción habrá que poner HTTPS delante (p. ej. `tailscale serve`).
- **Procesamiento dividido** (ver campo `where` en `web/src/tools.ts`):
  - `local`: en el navegador con `pdf-lib` (modificar), `pdfjs-dist` (renderizar) y OpenCV.js (escáner: bordes + perspectiva). El archivo no sale del dispositivo. Preferir esto siempre que sea viable.
  - `server`: FastAPI en el PC del usuario, en Docker, con binarios del sistema: Ghostscript/qpdf (comprimir, reparar), OCRmyPDF + Tesseract `spa` (OCR), LibreOffice headless (Office → PDF), pikepdf/PyMuPDF/pdf2docx según necesidad.
- **Firma**: solo manuscrita (dibujada/imagen), sin certificados digitales.

## Diseño (requisito del usuario)

Estilo Apple: limpio, premium, minimalista. Todo nuevo componente debe seguirlo.
- Tokens en `web/src/index.css` (`:root`): colores de sistema iOS en claro/oscuro automático (`--tint`, `--label*`, `--surface*`, `--c-<color>`), tipografía `-apple-system`. No introducir colores sueltos ni otra librería de UI.
- Patrones disponibles: `NavBar` translúcida (`ui/NavBar.tsx`, atrás con chevron + texto), `.large-title`, listas agrupadas `.list > .row` (como Ajustes, con `.row-icon` de color), `.btn-primary/.btn-secondary`, `.segmented`, `.toolbar` inferior, `.empty`, HUD `ui/Loading.tsx`. Iconos: `lucide-react` (trazo fino, similar a SF Symbols).
- Respetar zonas seguras del iPhone (`env(safe-area-inset-*)`) y objetivos táctiles de 44 px.
- Marca: **Folio**. Logo original en `resources/icon.png` (logotipo horizontal sobre negro, no usar como icono); versión vectorial fiel en `resources/folio-icon.svg` (fondo a sangre) de la que salen todos los iconos de `web/public/` (`logo.svg` redondeado, PNG de la PWA, maskable al 80 %, `favicon.ico`). Si cambia el logo, editar el SVG y regenerar los PNG con sharp (no usar el preset de `pwa-assets-generator`, que añade relleno blanco). Logotipo «FOLIO» en `web/public/wordmark.png`: máscara (blanco + alfa) extraída del logo original; se pinta con CSS `mask` y la variable `--wordmark` (#121E47 en claro, blanco en oscuro). La clave `documentos.signatures` de localStorage conserva el nombre antiguo a propósito.

## Escáner (`web/src/scan/`)

Flujo de `ScanPage.tsx`: foto (`<input capture="environment">`, más fiable en iOS que `getUserMedia`) → `detectDocument` → `CropEditor` (esquinas arrastrables + lupa) → `warpDocument` → filtro (`color`/`gray`/`bw`) + rotación → JPEG → `lib/pdf.ts` (`jpegsToPdf`) → `lib/share.ts` (hoja de compartir de iOS o descarga).
- OpenCV.js se carga bajo demanda (`lib/opencv.ts`, ~15 MB); `ScanPage` se importa con `lazy()` desde `App.tsx`. Toda `cv.Mat` debe liberarse con `.delete()` (memoria WASM).
- Las fotos se reducen a 3000 px (`scan/image.ts`) y las páginas a 2480 px por los límites de memoria de canvas en iOS.
- `navigator.share` debe invocarse directamente en el gesto del usuario: generar el PDF antes y compartir en un clic aparte.
- Las páginas viven solo en memoria (se pierden al recargar).

## Firma (`web/src/sign/`)

`SignPage.tsx`: abre un PDF (o lo recibe vía `navigate('/tool/sign', { state: { file } })`, p. ej. desde el escáner) → páginas renderizadas con pdf.js bajo demanda (`PageView.tsx`) → firmas colocadas encima (arrastrar / redimensionar) → `stamp.ts` las incrusta con pdf-lib → `ui/ExportView.tsx`.
- pdf.js: usar siempre `lib/pdfjs.ts` (build `legacy` por Safari iOS, worker vía `?url`). En v6 `render({ canvas, viewport })` y el documento se libera con `closePdf()` (`loadingTask.destroy()`).
- `Placement` guarda coordenadas normalizadas 0–1 de la página *tal como se ve*; la conversión a espacio PDF usa `viewport.convertToPdfPoint` + `rotate: degrees(page.rotate)`, lo que cubre /Rotate y CropBox (verificado con páginas a 0/90/180/270° y CropBox desplazado).
- Trazo de la firma en `ink.ts` (grosor según velocidad o presión del Pencil); se guarda como PNG transparente recortado en `localStorage` (`lib/signatures.ts`).
- `ui/ExportView.tsx` es la pantalla final común (Compartir / Descargar + acciones extra): reutilizarla en las demás herramientas.

## Herramientas de páginas (`web/src/pages/`)

Unir, Dividir y Organizar comparten piezas; reutilizarlas en herramientas nuevas:
- `lib/pdfOps.ts` → `buildPdfs(sources, outputs)`: toda operación de páginas (unir, extraer, reordenar, girar, duplicar) es una lista de `PageRef {source, page, rotate}` por archivo de salida. Copia en bloque por fuente para no duplicar fuentes/imágenes. También `parseRanges` ("1-3, 5").
- `lib/usePdf.ts` → `loadPdfFile` / `useOpenPdf` (bytes + documento pdf.js + proporciones; libera el anterior).
- `ui/PageThumb.tsx` (miniatura perezosa con caché por documento), `ui/PageTile.tsx` (tarjeta con selección estilo Fotos), `ui/OpenPdfEmpty.tsx` + `PdfInput`, `ui/useTask.ts` (HUD + errores).
- `ui/useSortable.ts`: reordenar por arrastre táctil; pulsación larga en rejillas, `data-drag-handle` en listas. Bloquea el scroll de iOS con un `touchmove` no pasivo durante el arrastre.
- `ui/ExportView.tsx` acepta varios archivos (`files[]`): los comparte todos o descarga un ZIP (`fflate`, sin recomprimir).

Texto sobre páginas (marca de agua, números; reutilizar para "Añadir texto"):
- `lib/pageGeometry.ts` → `viewOf(page)`: tamaño visto y `toUser(vx, vy)` (coordenadas vistas, y hacia abajo → espacio PDF), equivalente a `convertToPdfPoint` de pdf.js.
- `lib/textMarks.ts`: la disposición (`watermarkMarks`, `numberMarks` → `TextMark[]`) son funciones puras en coordenadas vistas que usan **a la vez** la vista previa (`ui/MarkPreview.tsx`, SVG sobre la página renderizada) y `applyTextMarks` (pdf-lib, rotación = ángulo + /Rotate). Así la vista previa coincide con el resultado.
- Fuentes estándar Helvetica (WinAnsi): admiten acentos y ñ, no emojis (se avisa con un error claro).
- Controles de formulario iOS en `ui/controls.tsx` (`OptionRow`, `Segmented`, `Switch`, `Slider`, `ColorDots`).

Anotaciones (`web/src/annotate/`, herramienta "Añadir texto"):
- Modelo en `lib/annotations.ts`: `text | rect (highlight/cover) | mark (✓/✗) | ink`, en puntos vistos (usa `OpenPdf.sizes`). La geometría (`textBaselines`, `markStrokes`, `bounds`, `moved`, `resized`) la comparten el SVG de `AnnotPage.tsx` y `applyAnnotations` (pdf-lib). Resaltado con `BlendMode.Multiply`.
- "Tapar" es un rectángulo blanco encima: **no** es una redacción segura (el texto sigue en el PDF); la UI lo avisa.
- Deshacer: `AnnotatePage` guarda instantáneas (`snapshot()`) antes de crear/borrar/editar y al empezar a mover (`onBegin`).
- Arrastres y dibujo bloquean el scroll de iOS con `ui/scrollLock.ts` (`setScrollLocked`), también en las firmas.

Herramientas del servidor (`server/app/tools.py` + `web/src/pages/ServerToolPage.tsx`):
- Registro `TOOLS` en el servidor: cada `Tool` declara su función, extensiones aceptadas, sufijo del nombre de salida y los binarios que necesita (`requires`). `/api/health` devuelve `tools: {id: disponible}`; la Home marca "Docker" o "Sin PC" según eso.
- Sin binarios (funcionan en Windows sin Docker): `protect`/`unlock` (pikepdf, AES-256 R=6), `repair` (pikepdf/qpdf, con Ghostscript como segundo intento), `pdf-to-word` (pdf2docx). Con Docker: `compress` (Ghostscript), `ocr` (OCRmyPDF + Tesseract spa/eng), `office-to-pdf` (LibreOffice con perfil aislado por petición).
- Errores para el usuario: lanzar `ToolError("mensaje")` → 422 con `detail`. Semáforo de 2 trabajos simultáneos; carpeta temporal por petición borrada tras responder.
- Frontend: añadir una herramienta de servidor = una entrada en `CONFIGS` de `ServerToolPage.tsx` (accept, opciones, validación, texto del resultado). `runServerTool` envía `file` + `options` (JSON) y lee el nombre de `Content-Disposition` y `X-Original-Size`.

Tests: la lógica de PDF y geometría se prueba con pdf-lib y pdf.js **reales** (sin mocks), leyendo el resultado como lo vería el usuario. `web/src/test/pdfHelpers.ts` tiene `TRICKY_PAGES` (páginas con /Rotate 90/180/270 y CropBox desplazado), `viewedText` y `viewedImageCorners`: cualquier código que coloque contenido en páginas debe probarse contra esas variantes. Los componentes React no tienen tests.

## Estructura

- `web/` — PWA: Vite + React + TypeScript, `react-router-dom`, `vite-plugin-pwa`. `src/tools.ts` es el catálogo de herramientas (cada una se marca `ready: true` al implementarla); `src/api.ts` es el cliente del backend.
- `server/` — FastAPI. `app/main.py` define `/api/health` (informa qué binarios externos hay) y sirve `web/dist` con `app.frontend(..., fallback="index.html")`. `app/tools.py` implementa `POST /api/tools/{tool}`.
- `docker-compose.yml` + `server/Dockerfile` — build multietapa: compila la PWA con Node y la sirve desde el contenedor Python junto a la API (mismo origen, puerto 8000).

Contrato frontend ↔ backend: `POST /api/tools/{tool}` con `multipart/form-data` (`files` repetido + opciones como campos string); responde el archivo resultante o `{"detail": "..."}` en error. En desarrollo Vite hace proxy de `/api` a `http://localhost:8000`.

## Comandos

Desde la raíz (atajos de `package.json`): `npm run dev`, `npm run api`, `npm run build`, `npm run lint`, `npm test` (frontend + servidor).

Frontend (en `web/`):
```
npm run dev       # https://<IP-del-PC>:5173 accesible desde el iPhone (aceptar el certificado autofirmado)
npm run build     # tsc -b + vite build → web/dist (genera service worker y manifest)
npm run lint      # oxlint
npm test          # Vitest (src/**/*.test.ts, entorno node)
npx vitest run src/lib/pdfOps.test.ts -t "une documentos"   # un archivo / un test
npx pwa-assets-generator --preset minimal-2023 public/logo.svg   # regenerar iconos tras cambiar el logo
```

Backend (en `server/`, Windows / Git Bash):
```
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/fastapi dev app/main.py     # http://localhost:8000
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest -q          # tests (los de Ghostscript/OCR/LibreOffice se saltan fuera de Docker)
.venv/Scripts/python -m pytest -q -k unlock   # filtrar por nombre
```
En Windows nativo faltan gs/qpdf/ocrmypdf/tesseract/soffice; las herramientas que los necesiten solo funcionan dentro de Docker.

Docker (en la raíz; requiere Docker Desktop con WSL 2):
```
docker compose up --build
```

## Hoja de ruta

1. ✅ Estructura base
2. ✅ Escanear → PDF (OpenCV.js, multipágina) — pendiente de validar con fotos reales en iPhone
3. ✅ Firma manuscrita (dibujar, guardar, colocar sobre la página) — pendiente de validar en iPhone
4. ✅ Organizar en local: unir, dividir, rotar, reordenar, borrar páginas — pendiente de validar en iPhone
4b. ✅ Locales: imágenes ↔ PDF, marca de agua, numerar páginas — pendiente de validar en iPhone
5. ✅ Herramientas de servidor: comprimir, OCR, conversiones, proteger/desbloquear — proteger/desbloquear/reparar/PDF a Word probadas en local; comprimir/OCR/Office pendientes de probar en Docker
6. ✅ Añadir texto y anotaciones (editar el texto existente de un PDF queda fuera de alcance) — pendiente de validar en iPhone
