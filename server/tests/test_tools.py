"""Tests de la API de herramientas (las que no necesitan binarios externos).

Comprimir, OCR y Office a PDF dependen de Ghostscript, Tesseract y LibreOffice:
sus tests se saltan automáticamente si esos programas no están (fuera de Docker).
"""

from __future__ import annotations

import io
import json
import shutil

import docx
import pikepdf
import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def pdf_bytes() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hola, informe de prueba ñ", fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data


@pytest.fixture(scope="module")
def encrypted(pdf_bytes: bytes) -> bytes:
    res = post("protect", pdf_bytes, password="1234")
    assert res.status_code == 200
    return res.content


def post(tool: str, data: bytes, name: str = "Informé.pdf", **options: str):
    return client.post(
        f"/api/tools/{tool}",
        files={"file": (name, data, "application/pdf")},
        data={"options": json.dumps(options)},
    )


def detail(res) -> str:
    return res.json()["detail"]


# ---------------------------------------------------------------- health


def test_health_lista_herramientas_disponibles():
    tools = client.get("/api/health").json()["tools"]
    assert set(tools) == {"compress", "ocr", "repair", "office-to-pdf", "pdf-to-word", "protect", "unlock"}
    for always in ("protect", "unlock", "repair", "pdf-to-word"):
        assert tools[always], f"{always} no necesita binarios externos"


# ---------------------------------------------------------------- proteger / desbloquear


def test_proteger_cifra_con_aes256(encrypted: bytes):
    with pikepdf.open(io.BytesIO(encrypted), password="1234") as pdf:
        assert pdf.is_encrypted
        assert pdf.encryption.R == 6
        assert pdf.encryption.bits == 256


def test_proteger_conserva_acentos_en_el_nombre(pdf_bytes: bytes):
    res = post("protect", pdf_bytes, password="1234")
    assert "Inform%C3%A9%20protegido.pdf" in res.headers["content-disposition"]


@pytest.mark.parametrize(("password", "message"), [("12", "al menos 4 caracteres"), ("", "al menos 4 caracteres")])
def test_proteger_rechaza_contrasenas_cortas(pdf_bytes: bytes, password: str, message: str):
    res = post("protect", pdf_bytes, password=password)
    assert res.status_code == 422
    assert message in detail(res)


def test_proteger_un_pdf_ya_protegido(encrypted: bytes):
    assert "protegido" in detail(post("protect", encrypted, password="abcd"))


def test_desbloquear_con_la_contrasena_correcta(encrypted: bytes):
    res = post("unlock", encrypted, password="1234")
    assert res.status_code == 200
    with pikepdf.open(io.BytesIO(res.content)) as pdf:
        assert not pdf.is_encrypted


@pytest.mark.parametrize(("password", "message"), [("mala", "Contraseña incorrecta."), ("", "Este PDF necesita contraseña para abrirse.")])
def test_desbloquear_con_contrasena_mala_o_vacia(encrypted: bytes, password: str, message: str):
    res = post("unlock", encrypted, password=password)
    assert res.status_code == 422
    assert detail(res) == message


def test_desbloquear_un_pdf_sin_proteger(pdf_bytes: bytes):
    assert detail(post("unlock", pdf_bytes)) == "Este PDF no está protegido."


# ---------------------------------------------------------------- reparar


def test_reparar_recupera_un_pdf_sin_tabla_xref(pdf_bytes: bytes):
    broken = pdf_bytes[: pdf_bytes.rfind(b"xref")] + b"\n%%EOF"
    res = post("repair", broken)
    assert res.status_code == 200
    with pikepdf.open(io.BytesIO(res.content)) as pdf:
        assert len(pdf.pages) == 1


def test_reparar_rechaza_lo_que_no_es_pdf():
    res = post("repair", b"esto no es un pdf")
    assert res.status_code == 422


# ---------------------------------------------------------------- PDF a Word


def test_pdf_a_word_genera_docx_con_el_texto(pdf_bytes: bytes):
    res = post("pdf-to-word", pdf_bytes)
    assert res.status_code == 200
    assert ".docx" in res.headers["content-disposition"]
    text = "\n".join(p.text for p in docx.Document(io.BytesIO(res.content)).paragraphs)
    assert "informe de prueba ñ" in text


# ---------------------------------------------------------------- validación del endpoint


def test_herramienta_desconocida():
    assert post("nada", b"x").status_code == 404


def test_tipo_de_archivo_no_admitido(pdf_bytes: bytes):
    assert post("protect", pdf_bytes, name="foto.jpg", password="1234").status_code == 415


def test_opciones_que_no_son_json(pdf_bytes: bytes):
    res = client.post("/api/tools/repair", files={"file": ("a.pdf", pdf_bytes)}, data={"options": "{no-json"})
    assert res.status_code == 400


def test_cabecera_con_el_tamano_original(pdf_bytes: bytes):
    assert post("repair", pdf_bytes).headers["x-original-size"] == str(len(pdf_bytes))


# ---------------------------------------------------------------- herramientas con binarios (Docker)

needs_gs = pytest.mark.skipif(not shutil.which("gs"), reason="necesita Ghostscript (Docker)")


@pytest.mark.skipif(shutil.which("gs"), reason="solo aplica fuera de Docker")
def test_sin_binarios_responde_503(pdf_bytes: bytes):
    assert post("compress", pdf_bytes).status_code == 503


@needs_gs
def test_comprimir_no_devuelve_un_archivo_mayor(pdf_bytes: bytes):
    res = post("compress", pdf_bytes, level="high")
    assert res.status_code == 200
    assert len(res.content) <= len(pdf_bytes)


# ---------------------------------------------------------------- seguridad


def test_rechaza_por_content_length_antes_de_leer_el_cuerpo(monkeypatch, pdf_bytes: bytes):
    import app.main as main

    monkeypatch.setattr(main, "_MAX_BODY", 100)  # límite diminuto para no generar 200 MB
    res = post("repair", pdf_bytes)
    assert res.status_code == 413
    assert "demasiado grande" in detail(res)


def test_corta_la_copia_si_la_subida_supera_el_limite(monkeypatch, pdf_bytes: bytes):
    import app.main as main
    import app.tools as tools

    monkeypatch.setattr(main, "_MAX_BODY", 10**9)  # deja pasar la cabecera...
    monkeypatch.setattr(tools, "MAX_UPLOAD", 100)  # ...pero el archivo real excede el límite
    res = post("repair", pdf_bytes)
    assert res.status_code == 413


def test_contrasena_demasiado_larga(pdf_bytes: bytes):
    res = post("protect", pdf_bytes, password="x" * 129)
    assert res.status_code == 422
    assert "128" in detail(res)


def test_el_404_no_repite_la_entrada_del_cliente():
    res = post("<script>alert(1)</script>", b"x")
    assert res.status_code == 404
    assert "<script>" not in res.text


def test_los_errores_internos_no_exponen_detalles(monkeypatch, pdf_bytes: bytes):
    import app.tools as tools

    def boom(*_args):
        raise RuntimeError("/ruta/secreta: fallo interno")

    monkeypatch.setitem(tools.TOOLS, "repair", tools.Tool(boom, tools.PDF, "", ".pdf", "application/pdf"))
    res = post("repair", pdf_bytes)
    assert res.status_code == 500
    assert "secreta" not in res.text
