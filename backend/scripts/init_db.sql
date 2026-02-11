-- Create triply role and database for local development.
-- Run with: psql -U postgres -f backend/scripts/init_db.sql
-- (Ignore "already exists" errors if re-running.)

CREATE USER triply WITH PASSWORD 'triply_dev';
CREATE DATABASE triply OWNER triply;
