-- Bump active-habit cap from 5 → 8.
--
-- Why: the expanded PROTOCOLS catalog covers 6 health pillars
-- (sleep / movement / nutrition / mind / recovery / connection). At 5
-- active habits the user can't even cover one habit per pillar, which
-- forces an arbitrary trade-off and contradicts the "develop into the
-- best version of yourself" framing. 8 gives breathing room without
-- diluting focus.
--
-- Surfaces this controls: add_user_habit RPC (server-side cap),
-- HabitsTab UI copy, ProtocolLibrary CTA.

CREATE OR REPLACE FUNCTION public.add_user_habit(_protocol_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_active_count int;
  v_existing uuid;
  v_new_id uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF NOT public.has_premium(v_user) THEN RETURN jsonb_build_object('error', 'premium_required'); END IF;
  IF _protocol_id IS NULL OR length(_protocol_id) = 0 OR length(_protocol_id) > 80 THEN
    RETURN jsonb_build_object('error', 'invalid_protocol');
  END IF;

  SELECT id INTO v_existing FROM public.user_habits
   WHERE user_id = v_user AND protocol_id = _protocol_id AND archived_at IS NULL;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_active', 'habit_id', v_existing);
  END IF;

  SELECT count(*) INTO v_active_count FROM public.user_habits
   WHERE user_id = v_user AND archived_at IS NULL;
  IF v_active_count >= 8 THEN
    RETURN jsonb_build_object('error', 'cap_reached');
  END IF;

  INSERT INTO public.user_habits (user_id, protocol_id)
  VALUES (v_user, _protocol_id)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'habit_id', v_new_id);
END;
$$;
