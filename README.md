# Triply

Triply is a travel planner app with a **React/Vite** frontend and a **Flask** backend backed by **PostgreSQL** (normalized schema, managed via **Flask-Migrate/Alembic**).

More detail in wiki page.

Base44: https://trippiz-ae8ac518.base44.app

## Repo layout

- `frontend/`: React + Vite app
- `backend/`: Flask API + SQLAlchemy models + Alembic migrations
- `docker-compose.yml`: local dev stack (db + backend + frontend)

## Prerequisites

- Docker + Docker Compose
- (Optional) Python 3.11+ if you want to run backend outside Docker
- (Optional) Node 18+ if you want to run frontend outside Docker

## Quickstart (recommended: Docker)

From repo root:

```bash
docker compose up --build
```

Services/ports:

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:5001/api`
- **PostgreSQL**: `localhost:5432` (user: `triply`, password: `triply_dev`, db: `triply`)

The backend container runs migrations on startup:

- `flask db upgrade` then `python run.py` (see `docker-compose.yml`)

## Environment variables

### Backend

- `SECRET_KEY`: used for signing JWTs (dev default exists; change in production)
- `DATABASE_URL`: SQLAlchemy database URL
- `CORS_ORIGINS`: comma-separated origins (defaults to `http://localhost:3000`)

See `backend/.env.example`.

### Frontend

- `VITE_API_URL`: API base path (in Docker we use `/api`)
- `VITE_PROXY_TARGET`: dev proxy target (in Docker: `http://backend:5000`)

See `frontend/.env.example` and `frontend/vite.config.ts`.

## Database & migrations

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

2) Point `DATABASE_URL` to a PostgreSQL instance and run migrations:

```bash
export DATABASE_URL="postgresql://triply:triply_dev@localhost:5432/triply"
flask db upgrade
python run.py
```

To provision a local `triply` role/db (if you’re not using Docker PostgreSQL), you can run:

```bash
psql -U <your_pg_superuser> -f backend/scripts/init_db.sql
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

## Troubleshooting

### “role triply does not exist” when connecting to localhost:5432

On macOS it’s common to have **two** PostgreSQL servers: one local (Homebrew) and one in Docker.
If local Postgres is bound to `localhost:5432`, your host `psql` might hit the local instance instead of Docker.

Options:

- Stop local Postgres (Homebrew service), then use Docker’s `localhost:5432`
- Or change Docker’s published port (e.g. map `5433:5432`) if you need both running
- Or use `docker exec triply-db psql ...` to always connect to the Docker database

