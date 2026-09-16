alter table public.puc_catalog_submissions
  add column if not exists submitter_declaration_version text,
  add column if not exists submitter_declared_at timestamptz,
  add column if not exists submitter_source_confirmed boolean not null default false;

alter table public.puc_catalog_submissions
  drop constraint if exists puc_catalog_submissions_correction_declaration_check;

alter table public.puc_catalog_submissions
  add constraint puc_catalog_submissions_correction_declaration_check
  check (
    kind <> 'correction'
    or (
      submitter_declaration_version is not null
      and char_length(trim(submitter_declaration_version)) between 1 and 50
      and submitter_declared_at is not null
      and submitter_source_confirmed = true
    )
  );

comment on column public.puc_catalog_submissions.submitter_declaration_version is
  'Version identifier of the responsibility declaration explicitly accepted by the student when submitting a correction.';
comment on column public.puc_catalog_submissions.submitter_declared_at is
  'Timestamp at which the student explicitly accepted the responsibility declaration for the correction proposal.';
comment on column public.puc_catalog_submissions.submitter_source_confirmed is
  'Student declaration that the proposed correction was checked against an official UAb/UC source before submission.';
