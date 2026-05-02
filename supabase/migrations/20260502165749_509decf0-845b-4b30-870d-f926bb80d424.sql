
REVOKE EXECUTE ON FUNCTION public.upsert_reflection(date,int,int,int,int,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.upsert_weekly_review(date,int,text,jsonb,jsonb,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.upsert_performance_snapshot(date,int,jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.append_chat_memory_batch(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.upsert_reflection(date,int,int,int,int,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_weekly_review(date,int,text,jsonb,jsonb,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_performance_snapshot(date,int,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_chat_memory_batch(jsonb) TO authenticated;
