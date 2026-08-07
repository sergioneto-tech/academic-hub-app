-- Mesmo com o acesso normal à cloud suspenso, o utilizador deve continuar a
-- conseguir eliminar voluntariamente a sua conta e os dados associados.

drop policy if exists "user_state_delete_own" on public.user_state;
create policy "user_state_delete_own"
on public.user_state
for delete
to authenticated
using (auth.uid() = user_id);
