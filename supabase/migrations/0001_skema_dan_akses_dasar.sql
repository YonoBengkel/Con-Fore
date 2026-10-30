-- 0001: skema etl, catatan migrasi, dan penutupan akses bawaan.
-- Pernyataan default privileges terakhir berlaku untuk semua skema, termasuk etl. Aman karena
-- pipeline berjalan sebagai pemilik (postgres) dan kebijakan RLS tidak memakai fungsi bantu.

create schema if not exists etl;
revoke all on schema etl from public, anon, authenticated, service_role;
revoke create on schema public from anon, authenticated, service_role;

create table etl.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres
  revoke execute on functions from public;
