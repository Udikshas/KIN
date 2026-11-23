# Kin API (FastAPI).
# Build context: apps/api. Coolify: Base Directory "/apps/api", Dockerfile "/Dockerfile".

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Fallback for webhook payloads while Postgres is down (SARVAM_CALLS_FILE). Mount a Coolify volume at /app/data.
RUN mkdir -p /app/data

RUN useradd --system --uid 1001 kin && chown kin /app/data
USER kin

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -fsS http://localhost:${PORT}/health || exit 1

# --proxy-headers: trust X-Forwarded-* from Coolify's Traefik proxy.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
