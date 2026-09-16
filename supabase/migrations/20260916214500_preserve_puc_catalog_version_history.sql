-- Preserve every validated PUC catalog version instead of overwriting a single row.
-- A newer validated correction must be inserted as a new row and the previous row
-- can then be marked inactive. This keeps the exact payload previously accepted
-- by students available for audit and diff generation.

alter table public.puc_catalog_entries
  drop constraint if exists puc_catalog_entries_course_code_academic_year_edition_key;

alter table public.puc_catalog_entries
  drop constraint if exists puc_catalog_entries_identity_version_key;

alter table public.puc_catalog_entries
  add constraint puc_catalog_entries_identity_version_key
  unique (course_code, academic_year, edition, version);

-- The old trigger mutated the existing row and therefore destroyed the previous
-- validated payload. Version publication is now insert-only; routine updates may
-- only be used for lifecycle metadata such as is_active.
drop trigger if exists puc_catalog_entries_bump_version on public.puc_catalog_entries;

-- Prevent accidental in-place edits of versioned academic content. Publishing a
-- correction must create a new row/version instead.
create or replace function private.puc_catalog_guard_immutable_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if new.course_code is distinct from old.course_code
     or new.course_name is distinct from old.course_name
     or new.academic_year is distinct from old.academic_year
     or new.edition is distinct from old.edition
     or new.evaluation_model is distinct from old.evaluation_model
     or new.payload is distinct from old.payload
     or new.source_hash is distinct from old.source_hash
     or new.source_page_count is distinct from old.source_page_count
     or new.version is distinct from old.version
     or new.validated_at is distinct from old.validated_at
     or new.created_at is distinct from old.created_at then
    raise exception 'puc_catalog_version_is_immutable';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.puc_catalog_guard_immutable_version() from public, anon, authenticated;

drop trigger if exists puc_catalog_entries_guard_immutable_version on public.puc_catalog_entries;
create trigger puc_catalog_entries_guard_immutable_version
before update on public.puc_catalog_entries
for each row execute function private.puc_catalog_guard_immutable_version();

comment on constraint puc_catalog_entries_identity_version_key on public.puc_catalog_entries is
  'Preserves immutable validated versions for each UC + academic year + edition identity.';
