-- Academic Hub — alinhar URLs internas com o projeto Supabase atual.
--
-- Evita que tarefas pg_cron continuem a chamar funções do projeto anterior
-- depois de migrações/restauros. Os segredos permanecem na tabela protegida;
-- apenas os endpoints públicos das Edge Functions são atualizados aqui.

insert into public.push_server_config (key, value)
values
  ('function_url', 'https://dayettlozmkjagrymjai.supabase.co/functions/v1/academic-push'),
  ('uab_calendar_function_url', 'https://dayettlozmkjagrymjai.supabase.co/functions/v1/uab-calendar-sync'),
  ('uab_assessment_function_url', 'https://dayettlozmkjagrymjai.supabase.co/functions/v1/uab-assessment-sync')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
