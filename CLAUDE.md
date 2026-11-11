# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

App personal (un único usuario) para escanear documentos con el iPhone, firmarlos y editar PDFs con las herramientas típicas de iLovePDF. iLovePDF se usa solo como referencia de funcionalidades/UX: no copiar su código, assets, marca ni usar sus APIs.

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
- Nombre y logo definitivos aún pendientes: cambiar en `index.html`, `manifest` de `vite.config.ts` y `public/logo.svg` (luego regenerar iconos).

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

## Estructura

- `web/` — PWA: Vite + React + TypeScript, `react-router-dom`, `vite-plugin-pwa`. `src/tools.ts` es el catálogo de herramientas (cada una se marca `ready: true` al implementarla); `src/api.ts` es el cliente del backend.
- `server/` — FastAPI. `app/main.py` define `/api/health` (informa qué binarios externos hay) y sirve `web/dist` con `app.frontend(..., fallback="index.html")`. `app/tools.py` implementa `POST /api/tools/{tool}`.
- `docker-compose.yml` + `server/Dockerfile` — build multietapa: compila la PWA con Node y la sirve desde el contenedor Python junto a la API (mismo origen, puerto 8000).

Contrato frontend ↔ backend: `POST /api/tools/{tool}` con `multipart/form-data` (`files` repetido + opciones como campos string); responde el archivo resultante o `{"detail": "..."}` en error. En desarrollo Vite hace proxy de `/api` a `http://localhost:8000`.

## Comandos

Frontend (en `web/`):
```
npm run dev       # https://<IP-del-PC>:5173 accesible desde el iPhone (aceptar el certificado autofirmado)
npm run build     # tsc -b + vite build → web/dist (genera service worker y manifest)
npm run lint      # oxlint
npx pwa-assets-generator --preset minimal-2023 public/logo.svg   # regenerar iconos tras cambiar el logo
```

Backend (en `server/`, Windows / Git Bash):
```
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/fastapi dev app/main.py     # http://localhost:8000
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
4. Organizar en local: unir, dividir, rotar, reordenar, borrar páginas
5. Herramientas de servidor: comprimir, OCR, conversiones, proteger/desbloquear
6. Añadir texto y anotaciones (editar el texto existente de un PDF queda fuera de alcance)
