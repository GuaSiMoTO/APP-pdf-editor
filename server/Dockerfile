# Etapa 1: compilar la PWA
FROM node:24-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Etapa 2: API + programas de procesamiento de PDF
FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        ghostscript qpdf pngquant \
        tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng \
        libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui \
        # Fuentes métricamente compatibles con Calibri/Cambria/Arial/Times para Office → PDF
        fonts-liberation fonts-crosextra-carlito fonts-crosextra-caladea fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server/app ./app
COPY --from=web /web/dist ./static
ENV FRONTEND_DIR=/app/static

EXPOSE 8000
CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
