
-- Fix RLS policies: recreate as explicitly PERMISSIVE

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
