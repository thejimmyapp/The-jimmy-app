FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

FROM debian:bookworm-slim AS fairy-stockfish
RUN apt-get update && apt-get install -y --no-install-recommends git make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch fairy_sf_14 https://github.com/fairy-stockfish/Fairy-Stockfish.git .
RUN make -C src -j2 build ARCH=x86-64

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend /app/frontend/dist /app/frontend/dist
COPY --from=fairy-stockfish /src/src/stockfish /app/engines/fairy-stockfish
RUN chmod +x /app/engines/fairy-stockfish
ENV FAIRY_STOCKFISH_PATH=/app/engines/fairy-stockfish
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
