create table if not exists public.uab_academic_calendars (
  academic_year text primary key,
  source_url text not null,
  source_hash text not null,
  payload jsonb not null,
  is_valid boolean not null default true,
  checked_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  last_error text
);

alter table public.uab_academic_calendars enable row level security;
alter table public.uab_academic_calendars force row level security;
revoke all on public.uab_academic_calendars from anon, authenticated;

insert into public.uab_academic_calendars (
  academic_year, source_url, source_hash, payload, is_valid, checked_at, published_at, updated_at
) values (
  '2026/2027',
  'https://portal.uab.pt/wp-content/uploads/2026/03/Calendario-Letivo-202627_1-ciclo_V2.pdf',
  'seed-2026-2027-v2',
  jsonb_build_object(
    'academicYear', '2026/2027',
    'officialSource', 'https://portal.uab.pt/wp-content/uploads/2026/03/Calendario-Letivo-202627_1-ciclo_V2.pdf',
    'events', jsonb_build_array(
      jsonb_build_object('id','candidaturas-com-provas','label','Candidaturas (com provas)','description','Período de candidaturas com provas de acesso','startDate','2026-03-10','endDate','2026-04-28','semester',0,'category','enrollment','alertDaysBefore',14,'icon','📋'),
      jsonb_build_object('id','candidaturas-sem-provas','label','Candidaturas (sem provas)','description','Acesso Direto, Reingresso, Mudança de Curso e UCI 1.º ciclo','startDate','2026-05-12','endDate','2026-06-16','semester',0,'category','enrollment','alertDaysBefore',14,'icon','📋'),
      jsonb_build_object('id','resultados-candidaturas','label','Publicitação de resultados','description','Publicitação dos resultados das candidaturas com provas','startDate','2026-07-22','endDate','2026-07-22','semester',0,'category','info','alertDaysBefore',7,'icon','📢'),
      jsonb_build_object('id','matriculas-1sem','label','Matrículas e inscrições — 1º semestre','description','Período de matrículas e inscrições do 1º semestre','startDate','2026-08-18','endDate','2026-09-01','semester',1,'category','enrollment','alertDaysBefore',14,'icon','🎓'),
      jsonb_build_object('id','creditacao-1sem','label','Creditação de competências — 1º semestre','description','Prazo para pedidos de creditação de competências','startDate','2026-09-01','endDate','2026-09-15','semester',1,'category','deadline','alertDaysBefore',7,'icon','📄'),
      jsonb_build_object('id','ambientacao','label','Módulo de Ambientação','description','Módulo de ambientação para estudantes matriculados pela 1.ª vez na UAb','startDate','2026-09-08','endDate','2026-09-18','semester',1,'category','info','alertDaysBefore',7,'icon','🧭'),
      jsonb_build_object('id','inicio-1sem','label','Atividades letivas — 1º semestre','description','Período de atividades letivas do 1º semestre','startDate','2026-09-14','endDate','2027-02-26','semester',1,'category','classes','alertDaysBefore',7,'icon','📚'),
      jsonb_build_object('id','anulacao-1sem','label','Anulação de inscrições — 1º semestre','description','Prazo limite para anular inscrições do 1º semestre','startDate','2026-10-30','endDate','2026-10-30','semester',1,'category','deadline','alertDaysBefore',14,'icon','⚠️'),
      jsonb_build_object('id','pausa-natal','label','Pausa letiva de Natal','description','Pausa letiva — Natal','startDate','2026-12-21','endDate','2027-01-03','semester',1,'category','break','alertDaysBefore',3,'icon','🎄'),
      jsonb_build_object('id','avaliacao-1sem','label','Avaliação — 1º semestre','description','Avaliação do 1º semestre — janeiro/fevereiro (consultar calendário de provas)','startDate','2027-01-01','endDate','2027-02-28','semester',1,'category','exams','alertDaysBefore',14,'icon','📝'),
      jsonb_build_object('id','matriculas-2sem','label','Matrículas e inscrições — 2º semestre','description','Período de matrículas e inscrições do 2º semestre','startDate','2026-11-17','endDate','2026-12-01','semester',2,'category','enrollment','alertDaysBefore',14,'icon','🎓'),
      jsonb_build_object('id','creditacao-2sem','label','Creditação de competências — 2º semestre','description','Prazo para pedidos de creditação de competências','startDate','2027-02-01','endDate','2027-02-15','semester',2,'category','deadline','alertDaysBefore',7,'icon','📄'),
      jsonb_build_object('id','inicio-2sem','label','Atividades letivas — 2º semestre','description','Período de atividades letivas do 2º semestre','startDate','2027-03-01','endDate','2027-07-31','semester',2,'category','classes','alertDaysBefore',7,'icon','📚'),
      jsonb_build_object('id','pausa-pascoa','label','Pausa letiva da Páscoa','description','Pausa letiva — Páscoa','startDate','2027-03-22','endDate','2027-03-28','semester',2,'category','break','alertDaysBefore',3,'icon','🐣'),
      jsonb_build_object('id','anulacao-2sem','label','Anulação de inscrições — 2º semestre','description','Prazo limite para anular inscrições do 2º semestre','startDate','2027-03-30','endDate','2027-03-30','semester',2,'category','deadline','alertDaysBefore',14,'icon','⚠️'),
      jsonb_build_object('id','avaliacao-2sem','label','Avaliação — 2º semestre','description','Avaliação do 2º semestre — junho/julho (consultar calendário de provas)','startDate','2027-06-01','endDate','2027-07-31','semester',2,'category','exams','alertDaysBefore',14,'icon','📝'),
      jsonb_build_object('id','epoca-especial','label','Época especial','description','Época especial de exames — novembro/dezembro','startDate','2027-11-01','endDate','2027-12-31','semester',0,'category','exams','alertDaysBefore',14,'icon','📝')
    )
  ),
  true,
  now(),
  '2026-03-26T00:00:00Z'::timestamptz,
  now()
)
on conflict (academic_year) do nothing;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.dispatch_uab_calendar_sync()
returns void
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  function_url text;
  cron_secret text;
begin
  select value into function_url from public.push_server_config where key = 'uab_calendar_function_url';
  select value into cron_secret from public.push_server_config where key = 'cron_secret';
  if function_url is null or cron_secret is null then return; end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',cron_secret),
    body := '{"mode":"refresh"}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function private.dispatch_uab_calendar_sync() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'academic-hub-uab-calendar-sync' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'academic-hub-uab-calendar-sync',
    '20 6 * * *',
    'select private.dispatch_uab_calendar_sync();'
  );
end $$;
