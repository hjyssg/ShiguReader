# FastAPI Project - Development (LAN Minimal)

## Overview

This branch is configured for **LAN/local development without Docker Compose**.

Removed from this branch:

- Docker Compose (dev/prod)
- Traefik-related setup
- JWT authentication flow
- Email password recovery and Mailcatcher workflow

## Backend (local)

```bash
cd backend
uv sync
uv run fastapi dev app/main.py
```

Backend URL: <http://localhost:8000>

OpenAPI Docs: <http://localhost:8000/docs>

## Frontend (local)

```bash
bun install
bun run dev
```

Frontend URL: <http://localhost:5173>

## Notes

- API authentication is disabled for LAN usage by design in this branch.
- Keep this branch for internal network environments only.