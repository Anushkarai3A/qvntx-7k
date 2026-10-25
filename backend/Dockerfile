FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN groupadd --gid 10001 windsight \
    && useradd --uid 10001 --gid windsight --create-home windsight

WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --upgrade pip==26.2.2 \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /app/data/cache \
    && chown -R windsight:windsight /app

USER windsight

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
