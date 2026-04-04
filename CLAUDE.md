# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Triply is an AI-powered trip planning application. Users describe a trip, and the app generates itineraries, flights, stays, activities, weather info, budget breakdowns, and tips via OpenAI, streamed progressively through Server-Sent Events (SSE).

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4 + Zustand (state) + React Router 6 + Leaflet (maps)
- **Backend**: Flask 3.0 + SQLAlchemy + Flask-Migrate (Alembic) + Pydantic + OpenAI SDK
- **Database**: PostgreSQL (SQLite for tests)
- **Auth**: Supabase Auth (frontend SDK) + JWT verification via JWKS (backend)
- **Optional APIs**: Google Maps (geocoding), OpenWeatherMap (weather overlays), Supabase Storage (image caching)

## Common Commands

### Frontend (`/frontend`)
```bash
npm install          # install dependencies
npm run dev          # dev server on port 3000 (proxies /api to backend)
npm run build        # production build
npm run lint         # ESLint (strict, max-warnings: 0)
```

### Backend (`/backend`)
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python run.py                          # dev server on port 5001
pytest                                 # run all tests
pytest tests/test_foo.py -k test_name  # run single test
flask db upgrade                       # apply migrations
flask db migrate -m "description"      # generate new migration
flask db downgrade -1                  # rollback last migration
```

### Docker (full stack)
```bash
docker compose up --build   # frontend :3000, backend :5001, auto-runs migrations
```

### Setup
1. Copy `backend/.env.example` → `backend/.env` and fill in values
2. Copy `frontend/.env.example` → `frontend/.env` and fill in values

## Architecture

### Data Flow
```
React SPA (Zustand stores) → Axios API client → Flask API → Services → SQLAlchemy ORM → PostgreSQL
```

### Trip Generation Pipeline (SSE)
1. `POST /api/trips` creates a trip row with `status=generating`
2. `GET /api/trips/{id}/stream` opens an SSE connection
3. Backend generates sections in phases: plan → stays → flights → activities → weather → budget → tips → overview
4. SSE events: `status`, `section_ready`, `done`, `error`
5. Backend applies guardrails and retries for critical sections

### Auth Flow
- Frontend uses Supabase client SDK for sign-in/signup
- Backend verifies JWT tokens via Supabase JWKS public endpoint (RS256/ES256)
- `@require_auth` decorator on protected routes (`app/utils/auth.py`)
- Auto-creates user row if missing (safety net for DB trigger failures)

### Key Patterns
- **Backend services layer**: Routes delegate to `app/services/` — `ai_service.py` (OpenAI calls), `trip_service.py` (persistence), `chat_service.py` (chat + scoped edits), `geocoding_service.py`, `pdf_service.py`
- **AI response schemas**: Pydantic models in `app/schemas/ai_schemas.py` define the shape of OpenAI responses
- **Frontend stores**: `authStore.ts` (user/session), `tripStore.ts` (trip form, generation state, section data), `chatStore.ts` (chat history, panel state)
- **Feature flags**: Runtime flags from `GET /api/feature-flags`, bootstrapped in `main.tsx` before app render
- **Path aliases**: `@/components`, `@/pages`, `@/hooks`, `@/store`, `@/services`, `@/utils`, `@/types`, `@/config` (configured in both `vite.config.ts` and `tsconfig.json`)
- **Chat-based edits**: Chat messages can trigger scoped modifications to trip sections via `chat_service.py`

### Frontend Dashboard
The dashboard (`Dashboard.tsx`) has tabbed sections: Overview, Plan, Activities, Flights, Stays, Weather, Tips, Map, Budget, Profile — each in `components/dashboard/`.

### Backend Config
Three environment classes in `config/config.py`: Development, Production, Testing. Config validates required env vars on load.
