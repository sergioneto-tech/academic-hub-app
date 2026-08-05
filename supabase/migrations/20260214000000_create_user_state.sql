-- Initial Academic Hub cloud-sync schema.
-- This migration must run before the later user_state security migrations.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_state FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_state FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_state TO authenticated;

DROP POLICY IF EXISTS "user_state_select_own" ON public.user_state;
CREATE POLICY "user_state_select_own"
ON public.user_state
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_state_insert_own" ON public.user_state;
CREATE POLICY "user_state_insert_own"
ON public.user_state
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_state_update_own" ON public.user_state;
CREATE POLICY "user_state_update_own"
ON public.user_state
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_state_delete_own" ON public.user_state;
CREATE POLICY "user_state_delete_own"
ON public.user_state
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

COMMIT;
