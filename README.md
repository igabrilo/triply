# Triply

Triply is an AI-powered travel planner that turns a simple trip idea into a complete, editable itinerary. A user can describe where they want to go, when they are travelling, who they are travelling with, and what kind of trip they want. Triply then generates a structured plan with places to stay, flights, daily activities, weather, budget estimates, destination tips, maps, and a polished trip overview.

This app was built as a student project by a small team of students who wanted to make travel planning feel less scattered. Instead of jumping between search tabs, map pins, weather pages, hotel lists, and notes apps, Triply brings the first version of a trip into one workspace that can keep improving with AI assistance.

## Mission

Trip planning is exciting, but it can also become messy very quickly. Our mission with Triply is to make the early planning phase easier, faster, and more inspiring by combining AI generation with practical travel tools.

Triply is designed to:

- Help travellers go from a rough idea to a usable itinerary.
- Keep trip details organized in one dashboard.
- Make plans editable through normal UI controls and conversational AI.
- Give useful context such as weather, maps, budgets, transport, and local tips.
- Show how modern web technologies and AI APIs can work together in a real product-style student project.

## Features

- AI-generated trip plans from a natural-language prompt.
- Progressive generation with Server-Sent Events, so sections appear as they are ready.
- Daily itinerary view with plan items, activities, stays, flights, weather, tips, and budget.
- Chat panel for AI-assisted edits to generated trip sections.
- Destination maps with Leaflet and optional weather overlays.
- Place images fetched during generation and cached for later use.
- Supabase authentication with backend JWT verification.
- Basic and Premium plan support with rate limits.
- Stripe checkout, customer portal, and webhook integration for Premium upgrades.
- PDF export for trip overviews.
- Docker-based local development setup.

## Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4 |
| State and routing | Zustand, React Router 6 |
| UI and maps | Leaflet, React Leaflet, Framer Motion, Lucide React |
| Backend | Python, Flask 3, Flask-CORS |
| Database | PostgreSQL, SQLAlchemy, Flask-Migrate, Alembic |
| Validation and AI schemas | Pydantic |
| AI generation | OpenAI-compatible API through xroute.ai |
| Authentication | Supabase Auth, JWT verification via JWKS |
| Image sources | Google Places API, Wikimedia/Wikipedia, LoremFlickr fallback |
| Image storage | Supabase Storage, WebP compression with Pillow |
| Payments | Stripe Checkout, Customer Portal, webhooks |
| Testing | Pytest, pytest-flask |
| Deployment/dev ops | Docker, Docker Compose, Gunicorn |

## How It Works

Triply is split into a React frontend and a Flask backend.

```text
React app
  -> Zustand stores
  -> Axios API client
  -> Flask /api routes
  -> service layer
  -> SQLAlchemy models
  -> PostgreSQL
```

The trip generation flow is streamed:

1. The frontend sends `POST /api/trips` with the user's trip request.
2. The backend creates a trip with `status=generating`.
3. The frontend opens `GET /api/trips/<trip_id>/stream`.
4. The backend generates trip sections in phases.
5. Each finished section is sent to the frontend as an SSE event.
6. The dashboard updates progressively until the final `done` event.

Current generation phases:

1. Plan
2. Stays
3. Flights
4. Activities
5. Weather
6. Budget
7. Tips
8. Overview

Hero images and item images are fetched during generation. The hero image starts in a background thread immediately, while plan items and activity/stay images are enriched through the image pipeline. When Supabase Storage is configured, images are cached as WebP files in the `trip-images` bucket.

## Repository Structure

```text
triply/
  backend/              Flask API, services, models, migrations, tests
  frontend/             React/Vite app, dashboard UI, stores, API client
  docker-compose.yml    Local full-stack development setup
  README.md             Project documentation
```

Important backend folders:

- `backend/app/routes/` - Flask route modules.
- `backend/app/services/` - AI, trip, chat, geocoding, image, and PDF logic.
- `backend/app/models/` - SQLAlchemy database models.
- `backend/app/schemas/` - Pydantic schemas for AI responses.
- `backend/migrations/` - Alembic migration history.
- `backend/tests/` - Backend test suite.

Important frontend folders:

- `frontend/src/pages/` - Home, dashboard, and account pages.
- `frontend/src/components/` - Shared UI, home page sections, dashboard sections, chat panel.
- `frontend/src/store/` - Zustand auth, trip, and chat stores.
- `frontend/src/services/` - Axios API client and Supabase client.
- `frontend/src/types/` - Shared TypeScript types.

## Backend Overview

The backend uses an app factory in `backend/app/__init__.py` and registers API routes through a shared blueprint in `backend/app/routes/__init__.py`.

Main route modules:

- `main_routes.py` - health checks, feature flags, reverse geocoding.
- `auth_routes.py` - current user, profile, preferences, notifications.
- `trip_routes.py` - trip CRUD, generation stream, itinerary actions, budget, weather, exports.
- `chat_routes.py` - chat history and AI-powered trip edits.
- `subscription_routes.py` - Stripe checkout, portal, and webhook handling.

Main services:

- `ai_service.py` - OpenAI-compatible model calls and structured generation.
- `trip_service.py` - trip persistence and section merge/replacement logic.
- `chat_service.py` - conversational editing workflow.
- `geocoding_service.py` - geocoding, place lookup, photo lookup, image fallbacks.
- `image_storage_service.py` - Supabase Storage uploads and WebP conversion.
- `pdf_service.py` - trip overview PDF export.

## Frontend Overview

The frontend is a Vite React app. It uses Supabase on the client for login/signup and sends the access token to the backend through Axios interceptors.

Routes:

- `/` - landing page and trip prompt.
- `/dashboard` - generated trip workspace.
- `/account` - account and profile settings.

Dashboard tabs:

- Overview
- Plan
- Activities
- Flights
- Stays
- Weather
- Tips
- Map
- Budget
- Profile

## Plans and Limits

Triply supports `basic` and `premium` user plans. Limits are enforced in the backend with Flask-Limiter and keyed by user ID.

| Feature | Basic | Premium |
|---|---:|---:|
| Trip generations | 2/day | 100/day |
| Chat edits | 20/hour | 200/hour |
| Activity generation | 10/day | 50/day |
| Weather refreshes | 10/day | 50/day |
| Weather map overlay | No | Yes |

Stripe is optional in local development. When configured, successful checkout upgrades a user to Premium, and webhook events keep subscription state in sync.

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.11+
- PostgreSQL, or a Supabase/Postgres connection string
- Optional: Docker and Docker Compose
- Optional API keys for AI generation, Supabase, Google Maps, OpenWeatherMap, and Stripe

### Environment Files

Create local environment files from the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Backend variables live in `backend/.env`.

Common backend variables:

- `DATABASE_URL` - PostgreSQL connection string.
- `SECRET_KEY` - Flask secret key.
- `CORS_ORIGINS` - allowed frontend origins.
- `SUPABASE_URL` - Supabase project URL for JWT verification.
- `SUPABASE_SERVICE_ROLE_KEY` - optional, enables Supabase Storage image caching.
- `XROUTE_AI_API_KEY` - required for AI generation and chat edits.
- `OPENAI_BASE_URL` - OpenAI-compatible base URL, defaults to xroute.ai.
- `OPENAI_MODEL_GENERATION` - premium generation model.
- `OPENAI_MODEL_GENERATION_MID` - mid-tier generation model.
- `OPENAI_MODEL_GENERATION_LITE` - lite/basic generation model.
- `OPENAI_MODEL_CHAT` - chat model.
- `GOOGLE_MAPS_API_KEY` - optional, enables Google Places geocoding/photos.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PREMIUM` - optional Premium billing setup.

Frontend variables live in `frontend/.env`.

Common frontend variables:

- `VITE_API_URL` - usually `/api` during local development.
- `VITE_PROXY_TARGET` - backend target for the Vite proxy.
- `VITE_OPENWEATHERMAP_API_KEY` - optional weather overlay support.
- `VITE_FEATURE_FIRST_PLAN_GUIDE` - local feature flag default.
- `VITE_FEATURE_NEXT_BEST_ACTIONS` - local feature flag default.
- `VITE_FEATURE_ACTIVATION_ANALYTICS` - local feature flag default.

## Run With Docker

From the repository root:

```bash
docker compose up --build
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5001/api`

The backend container installs dependencies, runs migrations, and starts the Flask app. The frontend container installs npm dependencies and starts Vite.

## Run Without Docker

Backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
flask db upgrade
python run.py
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Useful Commands

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run lint
```

Backend:

```bash
cd backend
pytest
flask db upgrade
flask db migrate -m "describe change"
flask db downgrade -1
```

Docker migration helpers:

```bash
docker exec triply-backend flask db current
docker exec triply-backend flask db history
docker exec triply-backend flask db upgrade
```

## API Overview

All application endpoints are served under `/api`.

Public and utility endpoints:

- `GET /api/`
- `GET /api/feature-flags`
- `GET /api/geocode/reverse`

Auth endpoints:

- `GET /api/auth/me`
- `PUT /api/auth/me`
- `PUT /api/auth/me/preferences`
- `PUT /api/auth/me/notifications`

Trip endpoints:

- `POST /api/trips`
- `GET /api/trips`
- `GET /api/trips/<trip_id>`
- `PUT /api/trips/<trip_id>`
- `DELETE /api/trips/<trip_id>`
- `GET /api/trips/<trip_id>/stream`
- `GET /api/trips/<trip_id>/overview/pdf`

Chat endpoints:

- `GET /api/trips/<trip_id>/chat`
- `POST /api/trips/<trip_id>/chat`

Subscription endpoints:

- `POST /api/subscriptions/checkout`
- `POST /api/subscriptions/portal`
- `POST /api/webhooks/stripe`

## Database and Migrations

Triply uses SQLAlchemy models and Alembic migrations through Flask-Migrate. Migrations live in `backend/migrations/`.

For Supabase-backed projects, `backend/scripts/supabase_trigger.sql` contains an optional trigger that creates a public user row when a Supabase Auth user is created. The backend also has a safety-net user creation path if an authenticated request arrives before the public row exists.

## Testing

Run backend tests with:

```bash
cd backend
pytest
```

Frontend production build check:

```bash
cd frontend
npm run build
```

## Project Status

Triply is a student project and an active prototype of an AI travel planning product. It demonstrates full-stack development, AI integration, authentication, payments, maps, image enrichment, streaming UX, and a normalized relational backend for generated travel data.
