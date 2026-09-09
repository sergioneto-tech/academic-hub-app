-- PostgreSQL 17 adds the MAINTAIN table privilege. Client roles do not need it.
-- Keep current and future public tables least-privileged.
revoke maintain on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated;
