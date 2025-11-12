-- Enable pg_net extension for database triggers
-- This allows the database to make HTTP requests to Edge Functions

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Verify it's enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

