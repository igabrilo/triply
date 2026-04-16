# Triply

Triply is an AI-assisted travel planner with:

- Frontend: React + TypeScript + Vite
- Backend: Flask + SQLAlchemy + Alembic
- Data: PostgreSQL (Supabase-hosted or any Postgres-compatible instance)
- Auth: Supabase Auth (JWT verified in backend via JWKS)

## Architecture at a glance

```text
React (Vite) + Zustand stores
	-> Axios API client (+ Supabase access token)
		-> Flask API (/api/*)
			-> Services layer (trip/chat/ai/geocoding/pdf/image storage)
				-> SQLAlchemy models (normalized relational schema)
					-> PostgreSQL

Trip generation path:
POST /api/trips -> creates trip row (status=generating)
GET  /api/trips/:id/stream (SSE) -> streams section-by-section AI generation
```

## Repository layout

- `frontend/`: SPA client, dashboard UI, stores, map/weather UX
- `backend/`: API routes, services, models, migrations, tests
- `docker-compose.yml`: local dev stack (frontend + backend)

## Backend architecture

### App composition

- App factory in `backend/app/__init__.py`
- SQLAlchemy + Flask-Migrate initialization
- CORS applied on `/api/*`
- Blueprints registered via `backend/app/routes/__init__.py`

### Route modules

- `main_routes.py`: health, reverse geocode, feature flags
- `auth_routes.py`: current user/profile/preferences/notifications
- `trip_routes.py`: trip CRUD, SSE generation, budget/weather/overview/activity actions, analytics
- `chat_routes.py`: chat history + scoped AI edits
- `subscription_routes.py`: Stripe checkout session, customer portal, webhook handler

### Services layer

- `ai_service.py`: typed OpenAI generation/chat calls (Pydantic schemas); three model tiers — `gpt-5.2` (premium), `gpt-4.1` (mid), `gpt-4.1-mini` (lite) for generation; `gpt-5-mini` for chat
- `trip_service.py`: core persistence and section replacement/merge logic
- `chat_service.py`: scoped edit workflow, diff persistence, plan-aware edit limits
- `geocoding_service.py`: Google Places API v1 (primary) + legacy + Nominatim fallbacks, image fetching with Wikimedia/LoremFlickr fallback chain
- `pdf_service.py`: overview PDF export
- `image_storage_service.py`: Supabase Storage caching (`trip-images` bucket, WebP compression at 640px for items, 1600px for hero)

### Auth model

- Frontend signs in with Supabase client.
- Backend verifies bearer tokens with Supabase JWKS (`SUPABASE_URL`).
- `@require_auth` injects `g.current_user`.
- If `public.users` row is missing, backend can auto-create a fallback user row.
- Optional SQL trigger script exists at `backend/scripts/supabase_trigger.sql` for automatic user row creation from `auth.users`.

### Generation pipeline (SSE)

`GET /api/trips/<trip_id>/stream` emits incremental events:

- `status`: phase updates
- `section_ready`: section payload ready
- `done`: generation completed
- `error`: generation failure with partial flag

Current phases:

1. plan
2. stays
3. flights
4. activities
5. weather
6. budget
7. tips
8. overview

The hero/banner image is fetched in a background thread from the start of generation (concurrently with Phase 1). An early `section_ready: overview` event with just the cached image URL is emitted after Phase 1 so the banner appears before generation completes.

Images for plan items, activities, and stays are fetched during enrichment (not at page-load time) using the Google Places API v1, cached to Supabase Storage as WebP, and stored as `cached_image_url` on the DB row or JSON payload. Transport category items use destination-aware queries (e.g. airport name, hotel area) to avoid returning corporate logos.

Guardrails and retries are applied for key sections (activities, weather, budget, overview), with usage events persisted for analytics.

### Data model highlights

Core entities are normalized in `backend/app/models/`:

- User domain: `user`, `user_preferences`, `notification_preferences`, `subscription`
- Trip domain: `trip`, `trip_day`, `plan_item`, `flight_option`, `stay_option`
- AI/chat domain: `trip_generation_run`, `chat_thread`, `chat_message`, `trip_edit`
- Product/analytics domain: `usage_event`, `price_alert`, `notification_event`, `invoice`

## Frontend architecture

### App shell and routing

- Entry point: `frontend/src/main.tsx`
- Runtime feature flags bootstrapped before render (`/api/feature-flags`)
- Routes in `frontend/src/App.tsx`:
	- `/` home
	- `/dashboard` trip workspace
	- `/account` account settings

### State management (Zustand)

- `authStore.ts`: Supabase auth session + backend profile sync
- `tripStore.ts`: form state, generation stream handling, trip mutations
- `chatStore.ts`: chat panel state, history, send-message flow

### API client

- `frontend/src/services/api.ts` uses Axios with `/api` base path
- Request interceptor attaches Supabase access token
- API modules: `authAPI`, `tripAPI`, `chatAPI`, `analyticsAPI`, `geocodeAPI`

### Dashboard modules

Dashboard is tab-driven (`Overview`, `Plan`, `Activities`, `Flights`, `Stays`, `Weather`, `Tips`, `Map`, `Budget`, `Profile`) with:

- Progressive generation UI while SSE sections arrive
- Chat side panel for scoped AI edits
- Leaflet-based map views with OpenWeather tile overlays (premium-gated)
- Budget and overview editing flows backed by dedicated backend endpoints
- `UpgradeModal` (`components/ui/UpgradeModal.tsx`) shown when a basic user hits a plan limit; redirects to Stripe Checkout
- `SubscriptionPanel` inside the Profile tab shows current plan, usage, and upgrade/manage links

## API overview (current)

Base path: `/api`

Public/non-auth routes:

- `GET /` health/status
- `GET /feature-flags`
- `GET /geocode/reverse`
- `GET /geocode/search` (disabled by design, returns 404)
- `GET /media/place-photo` (disabled by design, returns 404)
- `GET /media/overview-hero` (disabled by design, returns 404)

Auth/profile routes:

- `GET /auth/me`
- `PUT /auth/me`
- `PUT /auth/me/preferences`
- `PUT /auth/me/notifications`

Trip routes (selection):

- `POST /trips`
- `GET /trips`
- `GET /trips/<trip_id>`
- `PUT /trips/<trip_id>`
- `DELETE /trips/<trip_id>`
- `GET /trips/<trip_id>/stream` (SSE)
- `POST /trips/<trip_id>/events`
- `POST /trips/<trip_id>/geocode`
- `GET /trips/<trip_id>/overview/pdf`
- `PUT /trips/<trip_id>/flights/<flight_id>/select`
- `PUT /trips/<trip_id>/stays/<stay_id>/select`
- `POST /trips/<trip_id>/activities/<activity_id>/add-to-day`
- `POST /trips/<trip_id>/activities/generate-more`
- `PUT /trips/<trip_id>/activities/<activity_id>/status`
- `POST /trips/<trip_id>/plan-items/<item_id>/return-to-bucket`
- `POST /trips/<trip_id>/days/<int:day_number>/autofill`
- `GET /trips/<trip_id>/notes`
- `PUT /trips/<trip_id>/notes`
- `PUT /trips/<trip_id>/overview/image`
- `PUT /trips/<trip_id>/overview/description`
- `GET /trips/<trip_id>/budget`
- `POST /trips/<trip_id>/budget`
- `PUT /trips/<trip_id>/budget/<entry_id>`
- `DELETE /trips/<trip_id>/budget/<entry_id>`
- `POST /trips/<trip_id>/weather/refresh`

Chat and analytics routes:

- `GET /trips/<trip_id>/chat`
- `POST /trips/<trip_id>/chat`
- `GET /analytics/activation`

Subscription routes:

- `POST /subscriptions/checkout` — create Stripe Checkout session (auth required)
- `POST /subscriptions/portal` — create Stripe Customer Portal session (auth required)
- `POST /webhooks/stripe` — Stripe webhook handler (no auth, verified by signature)

## Environment variables

### Backend (`backend/.env`)

Required for normal app usage:

- `DATABASE_URL`: SQLAlchemy connection string
- `XROUTE_AI_API_KEY`: required for generation/chat (routed via xroute.ai OpenAI-compatible proxy)
- `OPENAI_BASE_URL` (default `https://api.xroute.ai/openai/v1`)
- `SUPABASE_URL`: required for JWT verification on protected routes

Common optional/operational vars:

- `MIGRATION_DATABASE_URL`: dedicated DB URL for Alembic migrations
- `SUPABASE_SERVICE_ROLE_KEY`: enables image caching to Supabase Storage
- `GOOGLE_MAPS_API_KEY`: enables Google Places geocoding and photo fetching (primary image source; falls back to Wikimedia/LoremFlickr without it)
- `OPENAI_MODEL_GENERATION` (default `gpt-5.2`) — used for premium-tier AI generation
- `OPENAI_MODEL_GENERATION_MID` (default `gpt-4.1`) — mid-tier generation
- `OPENAI_MODEL_GENERATION_LITE` (default `gpt-4.1-mini`) — lite/basic-tier generation
- `OPENAI_MODEL_CHAT` (default `gpt-5-mini`)
- `CORS_ORIGINS` (default `http://localhost:3000`)
- `FEATURE_FIRST_PLAN_GUIDE` (default `true`)
- `FEATURE_NEXT_BEST_ACTIONS` (default `true`)
- `FEATURE_ACTIVATION_ANALYTICS` (default `true`)

Stripe (optional — enables Premium subscription payments):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PREMIUM`: Stripe price ID for the Premium plan
- `FRONTEND_URL` (default `http://localhost:3000`): used in Stripe redirect URLs

Use `backend/.env.example` as a starting point.

### Frontend (`frontend/.env`)

- `VITE_API_URL` (typically `/api` in dev)
- `VITE_PROXY_TARGET` (for Vite proxy, e.g. `http://localhost:5001` or `http://backend:5000`)
- `VITE_OPENWEATHERMAP_API_KEY` (required for full weather overlays/features)
- `VITE_FEATURE_FIRST_PLAN_GUIDE`
- `VITE_FEATURE_NEXT_BEST_ACTIONS`
- `VITE_FEATURE_ACTIVATION_ANALYTICS`

Use `frontend/.env.example` as a starting point.

## Plan tiers

Two user plans with tiered rate limits enforced by `app/utils/rate_limit.py` (Flask-Limiter, keyed on user ID):

| Feature | Basic | Premium |
|---|---|---|
| Trip generations | 2 / day | 100 / day |
| Chat edits | 20 / hour | 200 / hour |
| Activity generation | 10 / day | 50 / day |
| Weather refresh | 10 / day | 50 / day |
| Weather map overlay | — | Yes |

Stripe integration upgrades `user.plan` from `basic` → `premium` on successful checkout and reverts it on cancellation/non-payment via webhook.

## Run with Docker

1. Create `backend/.env` and `frontend/.env` from their examples.
2. Start from repository root:

```bash
docker compose up --build
```

Default ports:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5001/api`

Backend container startup command runs migrations then starts app:

```bash
flask db upgrade && python run.py
```

## Run without Docker

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

## Migrations

Migrations live in `backend/migrations/`.

Useful commands (Docker):

```bash
docker exec triply-backend flask db current
docker exec triply-backend flask db history
docker exec triply-backend flask db upgrade
docker exec triply-backend flask db downgrade -1
docker exec triply-backend flask db migrate -m "describe change"
```

## Testing

Backend tests:

```bash
cd backend
pytest
```



