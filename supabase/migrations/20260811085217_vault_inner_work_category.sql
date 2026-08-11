-- ============================================================
-- Inner Work category — widen the vault_articles category CHECK.
-- Additive only: no data touched, no policy change (new rows
-- inherit the existing premium-read RLS automatically).
-- Constraint name verified against prod: vault_articles_category_id_check.
-- ============================================================

ALTER TABLE public.vault_articles
  DROP CONSTRAINT vault_articles_category_id_check;

ALTER TABLE public.vault_articles
  ADD CONSTRAINT vault_articles_category_id_check
  CHECK (category_id IN ('recipes','training','recovery','mind','nervous-system','inner-work'));
