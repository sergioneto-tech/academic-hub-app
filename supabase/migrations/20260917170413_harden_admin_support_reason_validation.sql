create or replace function public.log_admin_support_access(
  p_admin_user_id uuid,
  p_subject_user_id uuid,
  p_support_id text,
  p_reason text,
  p_fields_returned text[],
  p_action text default 'support_lookup'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_support_id text := upper(btrim(coalesce(p_support_id, '')));
begin
  if p_admin_user_id is null then
    raise exception 'admin_user_id_required';
  end if;
  if v_support_id !~ '^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$' then
    raise exception 'invalid_support_id';
  end if;
  if char_length(v_reason) < 8 or char_length(v_reason) > 500 then
    raise exception 'invalid_reason';
  end if;
  if upper(v_reason) = v_support_id or v_reason !~ '[[:alpha:]]' then
    raise exception 'invalid_reason';
  end if;
  if p_action not in ('support_lookup', 'exceptional_access') then
    raise exception 'invalid_action';
  end if;

  insert into private.admin_support_access_log(
    admin_user_id,
    subject_user_id,
    support_id,
    action,
    reason,
    fields_returned
  ) values (
    p_admin_user_id,
    p_subject_user_id,
    v_support_id,
    p_action,
    v_reason,
    coalesce(p_fields_returned, '{}'::text[])
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_admin_support_access(uuid, uuid, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.log_admin_support_access(uuid, uuid, text, text, text[], text) to service_role;
