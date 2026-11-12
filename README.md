<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="resources/folio-logo-dark.png">
    <img src="resources/folio-logo.png" alt="Folio" width="420">
  </picture>
</p>


<p align="center">
  Escanea, firma y edita PDFs desde el iPhone y el PC. Una app web instalable (PWA) de uso personal.
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-103%20passing-34C759">
</p>

---

La mayoría de las herramientas se ejecutan **dentro del navegador**: el documento no sale del dispositivo.
Solo las que necesitan programas de escritorio (OCR, compresión, conversión de Office) se envían a un servidor propio en el PC de casa.

## Instalación

```bash
git clone https://github.com/GuaSiMoTO/APP-pdf-editor.git folio && cd folio

# Frontend (PWA)
npm --prefix web install

# Servidor (Windows)
cd server
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt -r requirements-dev.txt
cd ..
```

Requiere **Node.js 24** y **Python 3.13+** (probado con Node 24.20 y Python 3.14 en Windows 10).
Para OCR, comprimir y Office → PDF hace falta además **Docker Desktop** (WSL 2).

## Inicio rápido

En dos terminales, desde la raíz:

```bash
npm run dev    # PWA  → https://<IP-del-PC>:5173
npm run api    # API  → http://localhost:8000  (Vite le reenvía /api)
```

Abre `https://<IP-del-PC>:5173` en el iPhone (misma Wi‑Fi), acepta el certificado autofirmado y en Safari pulsa
**Compartir → Añadir a pantalla de inicio**. Folio queda instalada como una app.

Comprobar que todo funciona:

```bash
npm test
```

```
 Test Files  13 passed (13)
      Tests  80 passed (80)
...
23 passed, 1 skipped in 3.54s
```

(80 tests del frontend con Vitest y 23 del servidor con pytest; el omitido necesita Docker.)

## Herramientas

| Grupo | Herramienta | Dónde se procesa |
|---|---|---|
| Escanear y firmar | **Escanear**: detección de bordes, enderezado y filtros, varias páginas | 📱 Dispositivo |
| | **Firmar**: firma manuscrita guardada, arrastrar y redimensionar | 📱 Dispositivo |
| Organizar | **Unir**, **Dividir**, **Organizar páginas** (reordenar, rotar, borrar, duplicar) | 📱 Dispositivo |
| Convertir | **Imágenes a PDF**, **PDF a imágenes** | 📱 Dispositivo |
| | **PDF a Word** | 🖥️ Servidor |
| | **Office a PDF** (Word, Excel, PowerPoint) | 🐳 Servidor (Docker) |
| Optimizar | **Reparar** | 🖥️ Servidor |
| | **Comprimir**, **Reconocer texto (OCR)** | 🐳 Servidor (Docker) |
| Editar y seguridad | **Marca de agua**, **Numerar páginas**, **Añadir texto** (texto, fecha, ✓/✗, resaltar, dibujar, deshacer) | 📱 Dispositivo |
| | **Proteger** (AES‑256), **Desbloquear** | 🖥️ Servidor |

Las herramientas 🐳 aparecen marcadas como «Docker» en la app si el servidor se ejecuta fuera del contenedor.
El resultado se comparte con la hoja de compartir de iOS o se descarga (varios archivos → ZIP).

## Uso con Docker

Sirve la PWA y la API completas en un solo contenedor, con Ghostscript, OCRmyPDF/Tesseract (español e inglés) y LibreOffice:

```bash
docker compose up --build    # → http://<IP-del-PC>:8000
```

> La cámara del iPhone exige HTTPS. En desarrollo lo pone Vite; para usar el contenedor desde el móvil
> hay que ponerle HTTPS delante (por ejemplo, `tailscale serve`).

## Cómo funciona

```
 iPhone / PC (navegador)                         PC de casa
┌─────────────────────────────┐   HTTPS / LAN   ┌──────────────────────────────┐
│ PWA · React + TypeScript    │ ──────────────▶ │ FastAPI                      │
│  pdf-lib   modificar PDFs   │  POST /api/...  │  pikepdf · pdf2docx          │
│  pdf.js    dibujar páginas  │ ◀────────────── │  Ghostscript · OCRmyPDF ·    │
│  OpenCV.js escáner          │     archivo     │  LibreOffice (Docker)        │
└─────────────────────────────┘                 └──────────────────────────────┘
```

Cada herramienta declara en `web/src/tools.ts` si es `local` o `server`. Las locales usan pdf-lib, pdf.js y OpenCV.js
(este último se descarga solo al escanear). Las de servidor llaman a `POST /api/tools/{tool}`, que procesa el archivo
en una carpeta temporal, con un máximo de 2 trabajos a la vez y tiempos límite, y la borra al responder.

La arquitectura completa, los flujos, los contratos y las decisiones de diseño están en
**[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**.

## Estructura

```
web/        PWA (Vite + React + TypeScript)
  src/scan/      escáner          src/sign/   firma
  src/annotate/  anotaciones      src/pages/  herramientas de páginas y de servidor
  src/lib/       lógica de PDF    src/ui/     componentes reutilizables
server/     API FastAPI (app/main.py, app/tools.py) y Dockerfile
docs/       documentación
resources/  logo original y versión vectorial
```

## Desarrollo

| Comando (desde la raíz) | Qué hace |
|---|---|
| `npm run dev` | PWA en modo desarrollo con HTTPS |
| `npm run api` | API con recarga automática |
| `npm test` | Tests de frontend (Vitest) y servidor (pytest) |
| `npm run lint` | oxlint |
| `npm run build` | Comprobación de tipos y compilación a `web/dist` |

Un solo test: `cd web && npx vitest run src/lib/pdfOps.test.ts` · `cd server && .venv/Scripts/python -m pytest -q -k desbloquear`.

Los tests de PDF usan pdf-lib y pdf.js reales, sin simulaciones, e incluyen páginas giradas (90/180/270°)
y con recorte desplazado. Las convenciones del proyecto (errores, memoria en iPhone, diseño) están en [CLAUDE.md](CLAUDE.md).

## Seguridad y privacidad

- Las herramientas locales no envían el documento a ningún sitio.
- El servidor limita las subidas a 200 MB, acota contraseñas y tiempos de proceso, y sus errores no exponen detalles internos.
- **La API no tiene autenticación**: está pensada solo para la red de casa. No la expongas a internet sin añadirla.
- «Tapar» en *Añadir texto* coloca un rectángulo encima, pero el texto original sigue en el PDF: no es una redacción segura.

## Licencia

Proyecto personal sin licencia publicada: todos los derechos reservados.
