create or replace function private.puc_catalog_validate_payload()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  p jsonb;
  item jsonb;
  total_points numeric := 0;
  final_points numeric := 0;
  event_count integer := 0;
begin
  p := case
    when tg_table_name = 'puc_catalog_entries' then to_jsonb(new)->'payload'
    else to_jsonb(new)->'proposed_payload'
  end;

  if jsonb_typeof(p) <> 'object' then raise exception 'puc_payload_must_be_object'; end if;
  if not (p ? 'events') or jsonb_typeof(p->'events') <> 'array' then raise exception 'puc_payload_events_must_be_array'; end if;

  event_count := jsonb_array_length(p->'events');
  if event_count > 30 then raise exception 'puc_payload_too_many_events'; end if;

  for item in select value from jsonb_array_elements(p->'events') loop
    if jsonb_typeof(item) <> 'object' then raise exception 'puc_payload_event_must_be_object'; end if;
    if coalesce(char_length(trim(item->>'name')), 0) < 1 or char_length(trim(item->>'name')) > 200 then raise exception 'puc_payload_invalid_event_name'; end if;
    if jsonb_typeof(item->'maxPoints') <> 'number' then raise exception 'puc_payload_event_points_required'; end if;
    if (item->>'maxPoints')::numeric <= 0 or (item->>'maxPoints')::numeric > 20 then raise exception 'puc_payload_invalid_event_points'; end if;
    total_points := total_points + (item->>'maxPoints')::numeric;

    if item ? 'startDate' and item->>'startDate' <> '' and item->>'startDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'puc_payload_invalid_start_date'; end if;
    if item ? 'endDate' and item->>'endDate' <> '' and item->>'endDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'puc_payload_invalid_end_date'; end if;
    if item ? 'gradeReleaseDate' and item->>'gradeReleaseDate' <> '' and item->>'gradeReleaseDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'puc_payload_invalid_grade_date'; end if;
  end loop;

  if p ? 'finalAssessment' and p->'finalAssessment' is not null then
    if jsonb_typeof(p->'finalAssessment') <> 'object' then raise exception 'puc_payload_final_assessment_must_be_object'; end if;
    if jsonb_typeof(p->'finalAssessment'->'maxPoints') <> 'number' then raise exception 'puc_payload_final_points_required'; end if;
    final_points := (p->'finalAssessment'->>'maxPoints')::numeric;
    if final_points <= 0 or final_points > 20 then raise exception 'puc_payload_invalid_final_points'; end if;
    if (p->'finalAssessment') ?| array['date','startDate','endDate','startTime','endTime','gradeReleaseDate'] then raise exception 'puc_payload_exam_dates_forbidden'; end if;
    total_points := total_points + final_points;
  end if;

  if event_count = 0 and final_points = 0 then raise exception 'puc_payload_empty_structure'; end if;
  if abs(total_points - 20) > 0.001 then raise exception 'puc_payload_points_must_total_20'; end if;
  return new;
end;
$$;

revoke all on function private.puc_catalog_validate_payload() from public, anon, authenticated;
