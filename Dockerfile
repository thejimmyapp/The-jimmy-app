FROM node:22-bookworm-slim AS frontend
ARG VITE_PUBLIC_BASE_URL=https://thejimmyapp.com
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL
WORKDIR /app/frontend
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

FROM debian:bookworm-slim AS fairy-stockfish
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL \
    https://github.com/fairy-stockfish/Fairy-Stockfish/releases/download/fairy_sf_14/fairy-stockfish_x86-64 \
    -o /fairy-stockfish && chmod +x /fairy-stockfish

FROM debian:bookworm-slim AS llama-cpp
ARG LLAMA_CPP_RELEASE=b9637
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /llama /tmp/llama-release && \
    curl -fsSL "https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_RELEASE}/llama-${LLAMA_CPP_RELEASE}-bin-ubuntu-x64.tar.gz" \
    -o /tmp/llama.tar.gz && \
    tar -xzf /tmp/llama.tar.gz -C /tmp/llama-release --strip-components=1 && \
    cp -a /tmp/llama-release/. /llama/ && chmod +x /llama/llama-cli

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend /app/frontend/dist /app/frontend/dist
COPY --from=fairy-stockfish /fairy-stockfish /app/engines/fairy-stockfish
COPY --from=llama-cpp /llama /app/llama
RUN chmod +x /app/engines/fairy-stockfish
ENV FAIRY_STOCKFISH_PATH=/app/engines/fairy-stockfish \
    LLAMA_CLI_PATH=/app/llama/llama-cli \
    LD_LIBRARY_PATH=/app/llama
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
