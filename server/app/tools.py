"""Herramientas que se ejecutan en el servidor.

Contrato con el frontend (web/src/api.ts → runServerTool):
  POST /api/tools/{tool}   multipart/form-data
    file:    el archivo de entrada
    options: JSON con las opciones de la herramienta (strings)
  → 200 con el archivo resultante (Content-Disposition con el nombre) y la cabecera
    X-Original-Size; o un error {"detail": "mensaje para el usuario"}.

Cada herramienta declara los programas externos que necesita (`requires`). Si falta
alguno (p. ej. fuera de Docker), /api/health la marca como no disponible.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import pikepdf
from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

log = logging.getLogger("tools")
router = APIRouter()

MAX_UPLOAD = 200 * 1024 * 1024
# OCR y LibreOffice consumen mucha CPU/RAM: como mucho 2 trabajos a la vez
_slots = threading.Semaphore(2)

PDF = (".pdf",)
OFFICE = (".doc", ".docx", ".odt", ".rtf", ".txt", ".xls", ".xlsx", ".ods", ".csv", ".ppt", ".pptx", ".odp")


class ToolError(Exception):
    """Error con un mensaje apto para mostrar al usuario."""


@dataclass(frozen=True)
class Tool:
    run: Callable[[Path, Path, dict[str, str]], Path]  # (entrada, carpeta de trabajo, opciones) -> salida
    accepts: tuple[str, ...]
    suffix: str  # se añade al nombre del archivo
    out_ext: str
    media_type: str
    requires: tuple[str, ...] = ()
    timeout: int = 300

    def available(self) -> bool:
        return all(shutil.which(b) for b in self.requires)


def _run(cmd: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired as exc:
        raise ToolError("El proceso ha tardado demasiado. Prueba con un archivo más pequeño.") from exc


def _open_pdf(path: Path, password: str = "") -> pikepdf.Pdf:
    try:
        return pikepdf.open(path, password=password)
    except pikepdf.PasswordError as exc:
        raise ToolError("El PDF está protegido con contraseña. Desbloquéalo primero.") from exc
    except pikepdf.PdfError as exc:
        raise ToolError("El archivo no parece un PDF válido.") from exc


# ---------------------------------------------------------------- herramientas

GS_LEVELS = {"low": "/printer", "medium": "/ebook", "high": "/screen"}


def compress(inp: Path, wd: Path, opts: dict[str, str]) -> Path:
    _open_pdf(inp).close()  # valida y detecta cifrado antes de llamar a Ghostscript
    out = wd / "out.pdf"
    level = GS_LEVELS.get(opts.get("level", "medium"), "/ebook")
    r = _run(["gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", f"-dPDFSETTINGS={level}",
              "-dDetectDuplicateImages=true", "-dNOPAUSE", "-dBATCH", "-dQUIET",
              f"-sOutputFile={out}", str(inp)], 300)
    if r.returncode != 0 or not out.exists():
        log.error("gs: %s", r.stderr[-2000:])
        raise ToolError("No se pudo comprimir el PDF.")
    # Si no se gana nada, se devuelve el original
    return out if out.stat().st_size < inp.stat().st_size else inp


OCR_LANGS = {"spa": "spa", "eng": "eng", "both": "spa+eng"}


def ocr(inp: Path, wd: Path, opts: dict[str, str]) -> Path:
    out = wd / "out.pdf"
    lang = OCR_LANGS.get(opts.get("lang", "both"), "spa+eng")
    r = _run(["ocrmypdf", "-l", lang, "--rotate-pages", "--deskew", "--skip-text",
              "--optimize", "1", "--output-type", "pdf", str(inp), str(out)], 900)
    if r.returncode == 8:
        raise ToolError("El PDF está protegido con contraseña. Desbloquéalo primero.")
    if r.returncode == 2:
        raise ToolError("El archivo no parece un PDF válido.")
    if r.returncode not in (0, 4, 6, 10) or not out.exists():
        log.error("ocrmypdf (%s): %s", r.returncode, r.stderr[-2000:])
        raise ToolError("No se pudo reconocer el texto.")
    return out


def repair(inp: Path, wd: Path, opts: dict[str, str]) -> Path:
    out = wd / "out.pdf"
    try:
        # qpdf (dentro de pikepdf) reconstruye la tabla de referencias al abrir
        with pikepdf.open(inp) as pdf:
            pdf.save(out)
        return out
    except pikepdf.PasswordError as exc:
        raise ToolError("El PDF está protegido con contraseña. Desbloquéalo primero.") from exc
    except pikepdf.PdfError:
        pass
    # Segundo intento: reescribir con Ghostscript, si está disponible
    if shutil.which("gs"):
        r = _run(["gs", "-o", str(out), "-sDEVICE=pdfwrite", "-dQUIET", str(inp)], 300)
        if r.returncode == 0 and out.exists():
            return out
    raise ToolError("El PDF está demasiado dañado para recuperarlo.")


def office_to_pdf(inp: Path, wd: Path, opts: dict[str, str]) -> Path:
    outdir = wd / "out"
    profile = (wd / "lo-profile").as_uri()  # perfil aislado: permite conversiones simultáneas
    r = _run(["soffice", "--headless", "--norestore", f"-env:UserInstallation={profile}",
              "--convert-to", "pdf", "--outdir", str(outdir), str(inp)], 300)
    out = outdir / f"{inp.stem}.pdf"
    if r.returncode != 0 or not out.exists():
        log.error("soffice: %s %s", r.stdout[-1000:], r.stderr[-2000:])
        raise ToolError("No se pudo convertir el documento.")
    return out


def pdf_to_word(inp: Path, wd: Path, opts: dict[str, str]) -> Path:
    _open_pdf(inp).close()
    from pdf2docx import Converter  # import pesado: solo cuando se usa

    out = wd / "out.docx"
    cv = Converter(str(inp))
    try:
        cv.convert(str(out))
    except Exception as exc:
        log.exception("pdf2docx")
        raise ToolError("No se pudo convertir el PDF a Word.") from exc
    finally:
        cv.close()
    return out


def protect(inp: Path, wd: Path, opts: dict[str, str]) -> Path:
    password = opts.get("password", "")
    if len(password) < 4:
        raise ToolError("La contraseña debe tener al menos 4 caracteres.")
    out = wd / "out.pdf"
    with _open_pdf(inp) as pdf:
        if pdf.is_encrypted:
            raise ToolError("El PDF ya está protegido.")
        # AES-256 (R=6); la misma contraseña para abrir y para cambiar permisos
        pdf.save(out, encryption=pikepdf.Encryption(user=password, owner=password, R=6))
    return out


def unlock(inp: Path, wd: Path, opts: dict[str, str]) -> Path:
    password = opts.get("password", "")
    out = wd / "out.pdf"
    try:
        pdf = pikepdf.open(inp, password=password)
    except pikepdf.PasswordError as exc:
        raise ToolError("Contraseña incorrecta." if password else "Este PDF necesita contraseña para abrirse.") from exc
    except pikepdf.PdfError as exc:
        raise ToolError("El archivo no parece un PDF válido.") from exc
    with pdf:
        if not pdf.is_encrypted:
            raise ToolError("Este PDF no está protegido.")
        pdf.save(out, encryption=False)
    return out


DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

TOOLS: dict[str, Tool] = {
    "compress": Tool(compress, PDF, " comprimido", ".pdf", "application/pdf", requires=("gs",)),
    "ocr": Tool(ocr, PDF, " OCR", ".pdf", "application/pdf", requires=("ocrmypdf", "tesseract", "gs"), timeout=900),
    "repair": Tool(repair, PDF, " reparado", ".pdf", "application/pdf"),
    "office-to-pdf": Tool(office_to_pdf, OFFICE, "", ".pdf", "application/pdf", requires=("soffice",)),
    "pdf-to-word": Tool(pdf_to_word, PDF, "", ".docx", DOCX),
    "protect": Tool(protect, PDF, " protegido", ".pdf", "application/pdf"),
    "unlock": Tool(unlock, PDF, " desbloqueado", ".pdf", "application/pdf"),
}


def availability() -> dict[str, bool]:
    return {tool_id: tool.available() for tool_id, tool in TOOLS.items()}


# ---------------------------------------------------------------- endpoint

@router.post("/{tool_id}")
def run_tool(tool_id: str, file: UploadFile, background: BackgroundTasks, options: str = Form("{}")) -> FileResponse:
    tool = TOOLS.get(tool_id)
    if not tool:
        raise HTTPException(404, f"Herramienta desconocida: {tool_id}")
    if not tool.available():
        raise HTTPException(503, "Esta herramienta necesita el servidor en Docker (faltan programas en el PC).")

    name = Path(file.filename or "documento").name
    if Path(name).suffix.lower() not in tool.accepts:
        raise HTTPException(415, "Tipo de archivo no admitido.")
    if file.size is not None and file.size > MAX_UPLOAD:
        raise HTTPException(413, "El archivo es demasiado grande (máximo 200 MB).")
    try:
        opts = {str(k): str(v) for k, v in json.loads(options).items()}
    except (ValueError, AttributeError) as exc:
        raise HTTPException(400, "Opciones no válidas.") from exc

    wd = Path(tempfile.mkdtemp(prefix=f"{tool_id}-"))
    background.add_task(shutil.rmtree, wd, ignore_errors=True)  # se borra tras enviar la respuesta
    try:
        inp = wd / f"input{Path(name).suffix.lower()}"
        with inp.open("wb") as fh:
            shutil.copyfileobj(file.file, fh)
        with _slots:
            out = tool.run(inp, wd, opts)
    except ToolError as exc:
        shutil.rmtree(wd, ignore_errors=True)
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        shutil.rmtree(wd, ignore_errors=True)
        log.exception("Error en %s", tool_id)
        raise HTTPException(500, "No se pudo procesar el archivo.") from exc

    return FileResponse(
        out,
        media_type=tool.media_type,
        filename=f"{Path(name).stem}{tool.suffix}{tool.out_ext}",
        headers={"X-Original-Size": str(inp.stat().st_size), "Access-Control-Expose-Headers": "Content-Disposition, X-Original-Size"},
    )
