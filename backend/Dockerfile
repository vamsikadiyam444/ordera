FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (libpq-dev for psycopg2, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (separate layer — only rebuilds when requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (separate layer — rebuilds on any code change)
COPY . .

# Run as non-root for security
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Production: no --reload flag (docker-compose.yml overrides this for dev)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
