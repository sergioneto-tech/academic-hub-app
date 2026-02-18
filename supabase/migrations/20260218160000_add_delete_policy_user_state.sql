-- Add DELETE policy to user_state table to allow users to delete their own data
-- This is required for the account deletion feature

-- Grant DELETE permission to authenticated users
GRANT DELETE ON TABLE public.user_state TO authenticated;

-- Create policy allowing users to delete their own data
DROP POLICY IF EXISTS "user_state_delete_own" ON public.user_state;
CREATE POLICY "user_state_delete_own"
ON public.user_state
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
