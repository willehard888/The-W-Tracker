
REVOKE EXECUTE ON FUNCTION public.upsert_athlete_profile(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_preference_signal(text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_chat_memory(text, text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_chat_memory(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_goal(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_goal_progress(uuid, numeric) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.upsert_athlete_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_preference_signal(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_chat_memory(text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_chat_memory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_goal(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_goal_progress(uuid, numeric) TO authenticated;
