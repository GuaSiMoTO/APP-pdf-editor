"""Backend de procesamiento pesado de PDFs.

Expone /api/* para las herramientas que no pueden ejecutarse en el navegador
(OCR, compresión, conversiones de Office...). En producción también sirve el
frontend compilado (web/dist), de modo que la PWA y la API comparten origen.
"""

import os
import shutil
from pathlib import Path

from fastapi import FastAPI

from app.tools import router as tools_router

app = FastAPI(title="Documentos API")

# Binarios externos que usan las herramientas; /api/health informa de cuáles hay.
EXTERNAL_BINARIES = ["gs", "qpdf", "ocrmypdf", "tesseract", "soffice"]


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "binaries": {name: shutil.which(name) is not None for name in EXTERNAL_BINARIES},
    }


app.include_router(tools_router, prefix="/api/tools")

# Frontend compilado. En Docker se copia a /app/static; en local apunta a web/dist.
frontend_dir = Path(os.environ.get("FRONTEND_DIR", Path(__file__).resolve().parents[2] / "web" / "dist"))
if frontend_dir.is_dir():
    app.frontend("/", directory=frontend_dir, fallback="index.html")
