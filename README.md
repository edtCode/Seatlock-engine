# Seeet — Monorepo

Overview
- This repository contains a `backend` service (API + worker) and a `frontend` app.

Prerequisites
- Docker & Docker Compose (for the backend)
- Node.js 18+ and pnpm (for the frontend)

Quickstart

1. Copy environment files

   - Backend: copy `backend/.env.example` to `backend/.env` and fill values.
   - Frontend: copy `frontend/.env.example` to `frontend/.env` and update `NEXT_PUBLIC_API_URL`.

2. Start the backend (Docker)

```bash
make up-backend
```

If you don't want Docker, you can run locally:

```bash
cd backend
pnpm install
pnpm dev
```

3. Start the frontend

```bash
make up-frontend
```

4. Start both together

```bash
make up-all
```

Secrets
- Do NOT commit `backend/.env` — it's included locally for convenience but contains secrets.
- Prefer using a secret manager or CI environment variables. Update `backend/.env` with your DB password, or set `DATABASE_URL` in your environment.

Running both
- Open two terminals (or use a process manager) and run the backend and frontend steps above.

Environment
- See `backend/.env.example` and `frontend/.env.example` for required variables.

Contributing
- Please avoid committing secrets. `.env` files are ignored by `.gitignore`.
