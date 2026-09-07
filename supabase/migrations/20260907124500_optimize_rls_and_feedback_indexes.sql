-- Academic Hub — otimizações de desempenho recomendadas pelo Supabase Advisor.
-- Mantém a semântica e os limites de acesso existentes; apenas evita que
-- auth.uid()/auth.jwt() sejam recalculados por linha e cobre FKs de feedback.

create index if not exists feedback_attachments_request_id_idx
  on public.feedback_attachments (request_id);
create index if not exists feedback_history_request_id_idx
  on public.feedback_history (request_id);
create index if not exists feedback_messages_request_id_idx
  on public.feedback_messages (request_id);
create index if not exists feedback_requests_user_id_idx
  on public.feedback_requests (user_id);

alter policy account_email_migration_select_own
  on public.account_email_migration
  using ((select auth.uid()) = user_id);

alter policy account_email_migration_insert_own
  on public.account_email_migration
  with check ((select auth.uid()) = user_id);

alter policy user_state_select_own
  on public.user_state
  using (
    (select auth.uid()) = user_id
    and (
      split_part(lower(coalesce((select auth.jwt()) ->> 'email', '')), '@', 2) = 'estudante.uab.pt'
      or exists (
        select 1
        from public.account_email_migration migration
        where migration.user_id = (select auth.uid())
          and now() < migration.deadline
      )
    )
  );

alter policy user_state_insert_own
  on public.user_state
  with check (
    (select auth.uid()) = user_id
    and (
      split_part(lower(coalesce((select auth.jwt()) ->> 'email', '')), '@', 2) = 'estudante.uab.pt'
      or exists (
        select 1
        from public.account_email_migration migration
        where migration.user_id = (select auth.uid())
          and now() < migration.deadline
      )
    )
  );

alter policy user_state_update_own
  on public.user_state
  using (
    (select auth.uid()) = user_id
    and (
      split_part(lower(coalesce((select auth.jwt()) ->> 'email', '')), '@', 2) = 'estudante.uab.pt'
      or exists (
        select 1
        from public.account_email_migration migration
        where migration.user_id = (select auth.uid())
          and now() < migration.deadline
      )
    )
  )
  with check (
    (select auth.uid()) = user_id
    and (
      split_part(lower(coalesce((select auth.jwt()) ->> 'email', '')), '@', 2) = 'estudante.uab.pt'
      or exists (
        select 1
        from public.account_email_migration migration
        where migration.user_id = (select auth.uid())
          and now() < migration.deadline
      )
    )
  );

alter policy user_state_delete_own
  on public.user_state
  using ((select auth.uid()) = user_id);

alter policy user_state_history_select_own
  on public.user_state_history
  using ((select auth.uid()) = user_id);

alter policy feedback_requests_select
  on public.feedback_requests
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
  );

alter policy feedback_requests_insert
  on public.feedback_requests
  with check ((select auth.uid()) = user_id);

alter policy feedback_requests_update_manager
  on public.feedback_requests
  using ((select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid)
  with check ((select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid);

alter policy feedback_messages_select
  on public.feedback_messages
  using (
    exists (
      select 1
      from public.feedback_requests r
      where r.id = feedback_messages.request_id
        and (
          r.user_id = (select auth.uid())
          or (select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
        )
    )
  );

alter policy feedback_messages_insert
  on public.feedback_messages
  with check (
    (
      author = 'student'
      and exists (
        select 1
        from public.feedback_requests r
        where r.id = feedback_messages.request_id
          and r.user_id = (select auth.uid())
      )
    )
    or (
      author = 'academic_hub'
      and (select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
    )
  );

alter policy feedback_history_select
  on public.feedback_history
  using (
    exists (
      select 1
      from public.feedback_requests r
      where r.id = feedback_history.request_id
        and (
          r.user_id = (select auth.uid())
          or (select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
        )
    )
  );

alter policy feedback_attachments_select
  on public.feedback_attachments
  using (
    exists (
      select 1
      from public.feedback_requests r
      where r.id = feedback_attachments.request_id
        and (
          r.user_id = (select auth.uid())
          or (select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
        )
    )
  );

alter policy feedback_attachments_insert
  on public.feedback_attachments
  with check (
    exists (
      select 1
      from public.feedback_requests r
      where r.id = feedback_attachments.request_id
        and r.user_id = (select auth.uid())
    )
  );
