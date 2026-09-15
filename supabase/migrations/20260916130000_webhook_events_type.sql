-- The webhook ledger recorded only that an event arrived. Which event, for
-- which product, from which store environment — the three things you need
-- when a purchase did something unexpected — were only in function logs.
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS product_id text,
  ADD COLUMN IF NOT EXISTS environment text;
