"""Herramientas que se ejecutan en el servidor.

Contrato con el frontend (web/src/api.ts → runServerTool):
  POST /api/tools/{tool}   multipart/form-data
    files: uno o varios archivos
    resto de campos: opciones propias de cada herramienta (strings)
  → responde con el archivo resultante (PDF, DOCX, ZIP...) o un error {"detail": ...}
"""

from fastapi import APIRouter, HTTPException, UploadFile

router = APIRouter()


@router.post("/{tool}")
async def run_tool(tool: str, files: list[UploadFile]) -> None:
    raise HTTPException(status_code=501, detail=f"La herramienta '{tool}' aún no está implementada")
