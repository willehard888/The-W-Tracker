-- ============================================================
-- HOTFIX: tg_tribe_notify referenced NEW.status from every table
-- it is attached to. tribe_milestones has no status column, so the
-- battle-resolved ELSIF threw `record "new" has no field "status"`
-- on EVERY milestone insert — which aborted create_tribe (founded
-- milestone), join_tribe for non-owners (member_joined), and the
-- nightly refresh_tribe_fire on any tier promotion (tier_up).
-- Branch on TG_TABLE_NAME first; only touch NEW fields that exist
-- on that table.
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_tribe_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind text;
  v_body jsonb;
BEGIN
  IF TG_TABLE_NAME = 'tribe_battles' THEN
    IF TG_OP = 'INSERT' THEN
      v_kind := 'battle_challenge';
      v_body := jsonb_build_object('battle_id', NEW.id);
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status = 'active' THEN
      v_kind := 'battle_resolved';
      v_body := jsonb_build_object('battle_id', NEW.id);
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'tribe_invites' AND TG_OP = 'INSERT' THEN
    v_kind := 'invite';
    v_body := jsonb_build_object('invite_id', NEW.id);
  ELSIF TG_TABLE_NAME = 'tribe_milestones' AND TG_OP = 'INSERT'
        AND NEW.kind IN ('tier_up','challenge_done') THEN
    v_kind := 'milestone';
    v_body := jsonb_build_object('milestone_id', NEW.id);
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://gcwuvijcuzhunkcauzom.supabase.co/functions/v1/tribe-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := v_body || jsonb_build_object('kind', v_kind)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- a push failure must never abort the write that triggered it
  END;

  RETURN NEW;
END $$;
