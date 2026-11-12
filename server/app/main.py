"""Backend de procesamiento pesado de PDFs.

Expone /api/* para las herramientas que no pueden ejecutarse en el navegador
(OCR, compresión, conversiones de Office...). En producción también sirve el
frontend compilado (web/dist), de modo que la PWA y la API comparten origen.
"""

import os
from pathlib import Path

from fastapi import FastAPI

from app.tools import availability
from app.tools import router as tools_router

app = FastAPI(title="Folio API")


@app.get("/api/health")
def health() -> dict:
    # `tools`: qué herramientas del servidor pueden usarse ahora (fuera de Docker faltan binarios)
    return {"status": "ok", "tools": availability()}


app.include_router(tools_router, prefix="/api/tools")

# Frontend compilado. En Docker se copia a /app/static; en local apunta a web/dist.
frontend_dir = Path(os.environ.get("FRONTEND_DIR", Path(__file__).resolve().parents[2] / "web" / "dist"))
if frontend_dir.is_dir():
    app.frontend("/", directory=frontend_dir, fallback="index.html")
