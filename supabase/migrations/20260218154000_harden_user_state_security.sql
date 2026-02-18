-- Harden security for public.user_state
-- - Ensure RLS is enabled + forced
-- - Ensure only authenticated can access (privileges + policies)

-- RLS
ALTER TABLE IF EXISTS public.user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_state FORCE ROW LEVEL SECURITY;

-- Privileges (extra layer above RLS)
REVOKE ALL ON TABLE public.user_state FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_state TO authenticated;

-- Policies (explicitly for authenticated)
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
