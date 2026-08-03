-- Drift capture: prod's handle_new_user was updated via the SQL editor
-- (friendly numeric username collision suffix — mogger, mogger2, …) but
-- no migration recorded it. This migration captures the LIVE prod definition
-- so the history reproduces it. Marked applied via 'supabase migration repair'
-- since it is already in production.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  candidate text;
  n int := 0;
BEGIN
  base_username := lower(trim(coalesce(
    NEW.raw_user_meta_data->>'username',
    split_part(coalesce(NEW.email, ''), '@', 1),
    'user'
  )));
  base_username := regexp_replace(base_username, '[^a-z0-9_]+', '_', 'g');
  base_username := trim(both '_' from base_username);
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  -- Try the clean name first, then name2, name3 … appending a friendly number
  -- on collision. The INSERT is retried on a unique-violation so two concurrent
  -- signups of the same base can never fail signup.
  LOOP
    IF n = 0 THEN
      candidate := left(base_username, 20);
    ELSE
      candidate := left(base_username, 20 - length((n + 1)::text)) || (n + 1)::text;
    END IF;

    BEGIN
      INSERT INTO public.profiles (user_id, username, referral_code, trial_started_at)
      VALUES (
        NEW.id,
        candidate,
        left(candidate || '_' || substring(NEW.id::text, 1, 6), 20),
        now()
      );
      RETURN NEW;                                   -- inserted cleanly
    EXCEPTION
      WHEN unique_violation THEN
        -- Trigger fired twice for the same user? Then the profile already
        -- exists — that's fine, we're done.
        IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
          RETURN NEW;
        END IF;
        -- Otherwise the username was taken — try the next number.
        n := n + 1;
        IF n > 9999 THEN                            -- pathological guard
          INSERT INTO public.profiles (user_id, username, referral_code, trial_started_at)
          VALUES (
            NEW.id,
            left(base_username, 13) || '_' || substring(NEW.id::text, 1, 6),
            left(base_username || '_' || substring(NEW.id::text, 1, 6), 20),
            now()
          )
          ON CONFLICT (user_id) DO NOTHING;
          RETURN NEW;
        END IF;
    END;
  END LOOP;
END;
$function$
;
