-- Table privileges for signed-in users.
-- Newer hosted Supabase projects no longer grant public-schema tables to the API roles
-- automatically, which surfaced as "permission denied for table farm_members".
-- Row access is still decided by the RLS policies on every table.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Tables and sequences created by later migrations get the same privileges.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
