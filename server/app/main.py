"""Backend de procesamiento pesado de PDFs.

Expone /api/* para las herramientas que no pueden ejecutarse en el navegador
(OCR, compresión, conversiones de Office...). En producción también sirve el
frontend compilado (web/dist), de modo que la PWA y la API comparten origen.

Seguridad: la API no tiene autenticación; está pensada para la red de casa
(un único usuario). Antes de exponerla a internet habría que añadirla.
"""

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.tools import MAX_UPLOAD, availability
from app.tools import router as tools_router

app = FastAPI(title="Folio API")

# Margen para las cabeceras multipart y el campo de opciones
_MAX_BODY = MAX_UPLOAD + 1024 * 1024


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    """Rechaza subidas demasiado grandes por su Content-Length, antes de leer el cuerpo.
    (tools._save_upload vuelve a comprobarlo al copiar, por si la cabecera mintiera.)"""
    if request.method == "POST" and request.url.path.startswith("/api/tools/"):
        length = request.headers.get("content-length")
        if length is None:
            return JSONResponse({"detail": "Falta el tamaño de la subida."}, status_code=411)
        if not length.isdigit() or int(length) > _MAX_BODY:
            return JSONResponse({"detail": "El archivo es demasiado grande (máximo 200 MB)."}, status_code=413)
    return await call_next(request)


@app.get("/api/health")
def health() -> dict:
    # `tools`: qué herramientas del servidor pueden usarse ahora (fuera de Docker faltan binarios)
    return {"status": "ok", "tools": availability()}


app.include_router(tools_router, prefix="/api/tools")

# Frontend compilado. En Docker se copia a /app/static; en local apunta a web/dist.
frontend_dir = Path(os.environ.get("FRONTEND_DIR", Path(__file__).resolve().parents[2] / "web" / "dist"))
if frontend_dir.is_dir():
    app.frontend("/", directory=frontend_dir, fallback="index.html")
