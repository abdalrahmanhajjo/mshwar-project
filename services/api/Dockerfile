# syntax=docker/dockerfile:1
# Production image for the FastAPI service. Local development overrides the
# command with --reload and mounts the source (see docker-compose.yml).
FROM python:3.14-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
# The python:3.11-slim tag lags Debian's security archive, so the published
# fixes for gzip, libpcre2, libsqlite3 and perl-base are not in the base layer
# yet. Pull them at build time instead of pinning a newer Python minor.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS runtime
# Wheels exist for every runtime dependency, so no compiler is needed.
# The base image's build tooling carries advisories that are not ours: wheel
# 0.45.1, msgpack 1.1.2 vendored inside pip, and a setuptools 70.3.0 wheel
# bundled in ensurepip. None are needed once requirements are installed and
# the app is started with uvicorn, so install with them and then remove them.
COPY requirements.txt ./
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements.txt \
    && pip uninstall -y wheel \
    && rm -rf /usr/local/lib/python3.11/site-packages/pip \
              /usr/local/lib/python3.11/site-packages/pip-*.dist-info \
              /usr/local/lib/python3.11/ensurepip \
              /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.11
RUN useradd --create-home --uid 10001 mshwar
COPY app ./app
COPY scripts ./scripts
USER mshwar
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
