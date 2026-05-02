REVOKE EXECUTE ON FUNCTION public.get_active_coach_program(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_active_coach_program(uuid) TO authenticated;