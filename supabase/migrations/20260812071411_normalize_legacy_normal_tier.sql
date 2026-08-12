-- Legacy tier cleanup: 'normal' predates the current tier ladder and is not
-- in the client's TIER_ORDER — a user carrying it ranks as recruit but gets
-- no "next tier" display (getNextTier returns null). One live row found in
-- prod. Normalize to 'recruit'; update_status_tier recomputes upward from
-- there on the next run.
UPDATE public.profiles SET status_tier = 'recruit' WHERE status_tier = 'normal';
