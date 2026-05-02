-- Extend vault_articles with course/lesson fields
ALTER TABLE public.vault_articles
  ADD COLUMN IF NOT EXISTS lesson_number int,
  ADD COLUMN IF NOT EXISTS why_it_matters text,
  ADD COLUMN IF NOT EXISTS try_today text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_takeaways text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quiz jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS course_role text NOT NULL DEFAULT 'protocol';

-- Constrain course_role values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_articles_course_role_chk'
  ) THEN
    ALTER TABLE public.vault_articles
      ADD CONSTRAINT vault_articles_course_role_chk
      CHECK (course_role IN ('foundations','protocol','recap'));
  END IF;
END $$;

-- Index for course ordering
CREATE INDEX IF NOT EXISTS vault_articles_category_lesson_idx
  ON public.vault_articles (category_id, lesson_number);

-- Lesson progress table
CREATE TABLE IF NOT EXISTS public.vault_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  article_id uuid NOT NULL REFERENCES public.vault_articles(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  quiz_score int,
  UNIQUE (user_id, article_id)
);

ALTER TABLE public.vault_lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own lesson progress" ON public.vault_lesson_progress;
CREATE POLICY "Users read own lesson progress"
  ON public.vault_lesson_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Premium users mark own lessons complete" ON public.vault_lesson_progress;
CREATE POLICY "Premium users mark own lessons complete"
  ON public.vault_lesson_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_premium(auth.uid()));

DROP POLICY IF EXISTS "Premium users update own lesson progress" ON public.vault_lesson_progress;
CREATE POLICY "Premium users update own lesson progress"
  ON public.vault_lesson_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND public.has_premium(auth.uid()))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own lesson progress" ON public.vault_lesson_progress;
CREATE POLICY "Users delete own lesson progress"
  ON public.vault_lesson_progress
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS vault_lesson_progress_user_idx
  ON public.vault_lesson_progress (user_id);