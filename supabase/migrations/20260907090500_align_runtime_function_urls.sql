-- Academic Hub — alinhar URLs internas com o projeto Supabase de produção.
--
-- O projeto dayettlozmkjagrymjai é o backend legado criado pelo Lovable Cloud.
-- O projeto de produção sob controlo direto é apgoyzfzuukkpmuxiqvy.
-- Apenas os endpoints públicos das Edge Functions são atualizados aqui.

insert into public.push_server_config (key, value)
values
  ('function_url', 'https://apgoyzfzuukkpmuxiqvy.supabase.co/functions/v1/academic-push'),
  ('uab_calendar_function_url', 'https://apgoyzfzuukkpmuxiqvy.supabase.co/functions/v1/uab-calendar-sync'),
  ('uab_assessment_function_url', 'https://apgoyzfzuukkpmuxiqvy.supabase.co/functions/v1/uab-assessment-sync')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
