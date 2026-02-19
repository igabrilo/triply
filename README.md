# Triply

Triply is a travel planner app with a **React/Vite** frontend and a **Flask** backend backed by **PostgreSQL on Supabase Cloud** (normalized schema, managed via **Flask-Migrate/Alembic**).

More detail in wiki page.

Base44: https://trippiz-ae8ac518.base44.app

## Repo layout

- `frontend/`: React + Vite app
- `backend/`: Flask API + SQLAlchemy models + Alembic migrations
- `docker-compose.yml`: dev stack (backend + frontend; database is on Supabase)

## Prerequisites

- Docker + Docker Compose
- A **Supabase** project (free tier is fine) — you'll need the **Session Pooler** and **Direct Connection** strings from *Settings → Database*
- (Optional) Python 3.11+ if you want to run backend outside Docker
- (Optional) Node 18+ if you want to run frontend outside Docker

## Quickstart (recommended: Docker)

1. Copy `backend/.env.example` → `backend/.env` and fill in your Supabase connection strings (see below).
2. From repo root:

```bash
docker compose up --build
```

Services/ports:

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:5001/api`
- **PostgreSQL**: hosted on Supabase Cloud (no local DB needed)

The backend container runs migrations on startup:

- `flask db upgrade` then `python run.py` (see `docker-compose.yml`)

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **Session Pooler** connection string (`?sslmode=require`) |
| `MIGRATION_DATABASE_URL` | ✅ | Supabase **Direct Connection** string (`?sslmode=require`) — used by Alembic |
| `SECRET_KEY` | ✅ | Used for signing JWTs (change in production) |
| `CORS_ORIGINS` | | Comma-separated origins (defaults to `http://localhost:3000`) |
| `OPENAI_API_KEY` | ✅ | Required for trip generation and chat |
| `GOOGLE_MAPS_API_KEY` | | Optional — enables real geocoding |

See `backend/.env` for the full list including OAuth keys.

### Frontend

- `VITE_API_URL`: API base path (in Docker we use `/api`)
- `VITE_PROXY_TARGET`: dev proxy target (in Docker: `http://backend:5000`)

See `frontend/.env.example` and `frontend/vite.config.ts`.

## Database & migrations

The database is hosted on **Supabase Cloud**. Alembic migrations use `MIGRATION_DATABASE_URL` (direct connection) to apply schema changes.

Migrations live in:

- `backend/migrations/`
- initial schema migration: `backend/migrations/versions/b47b91689d38_initial.py`

Useful commands (Docker):

```bash
docker exec triply-backend flask db current
docker exec triply-backend flask db history
docker exec triply-backend flask db upgrade
docker exec triply-backend flask db downgrade -1
```

If you change models and need a new migration:

```bash
docker exec triply-backend flask db migrate -m "describe change"
docker exec triply-backend flask db upgrade
```

## Backend API (high level)

Base: `/api`

- `GET /` health check
- `POST /auth/register` register user
- `POST /auth/login` login (returns JWT)
- `GET /auth/me` current user (JWT required)
- `POST /trips` create trip (JWT required)
- `GET /trips` list trips (JWT required)
- `GET /trips/<trip_id>` get trip (JWT required)
- `PUT /trips/<trip_id>` update trip (JWT required)
- `DELETE /trips/<trip_id>` delete trip (JWT required)
- `GET /trips/<trip_id>/chat` chat history (JWT required)
- `POST /trips/<trip_id>/chat` send chat message (JWT required)

## Running without Docker (optional)

### Backend (local)

1) Create a virtualenv and install deps:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2) Make sure `backend/.env` has your Supabase connection strings, then:

```bash
flask db upgrade
python run.py
```

### Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

## Testing

Backend tests (pytest):

```bash
cd backend
pytest
```



