-- Academic Hub — endurecimento de segurança sem alterar o comportamento funcional.
-- 1) Fixa o search_path do Auth Hook para remover resolução mutável de objetos.
-- 2) Reduz os privilégios das tabelas acessíveis pelo frontend ao mínimo necessário.

alter function public.hook_restrict_signup_to_uab(jsonb)
  set search_path = pg_catalog;

revoke all on table public.account_email_migration from anon, authenticated;
grant select, insert on table public.account_email_migration to authenticated;

revoke all on table public.push_preferences from anon, authenticated;
grant select, insert, update on table public.push_preferences to authenticated;

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

revoke all on table public.user_state from anon, authenticated;
grant select, insert, update, delete on table public.user_state to authenticated;

revoke all on table public.user_state_history from anon, authenticated;
grant select on table public.user_state_history to authenticated;
