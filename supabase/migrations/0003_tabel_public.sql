-- 0003: tabel siap tampil di skema public. Hanya SELECT untuk anon, RLS menyala, satu kebijakan
-- baca per tabel. Isinya dibangun ulang setiap publikasi dengan DELETE + INSERT, tidak pernah
-- DROP atau CREATE TABLE AS, supaya GRANT dan RLS di bawah tidak hilang.

grant usage on schema public to anon;

create table public.sources (
  source_id text primary key,
  name text not null,
  url text not null,
  terms_url text not null,
  license text not null,
  attribution_text text not null
);

create table public.series_meta (
  series_id text primary key,
  source_id text not null,
  country text not null,
  name_id text not null,
  unit text not null,
  concept text not null,
  frequency text not null,
  citation text not null,
  last_period text,
  last_release_date date,
  next_release_date date
);

create table public.latest_values (
  series_id text primary key,
  period text not null,
  value numeric not null,
  previous_value numeric,
  release_date date,
  seen_date date,
  source_id text not null,
  is_stale boolean not null
);

create table public.chart_series (
  chart_id text primary key,
  series_ids text[] not null,
  points jsonb not null,
  updated_at timestamptz not null
);

create table public.targets (
  series_id text not null,
  year int not null,
  target_kind text not null,
  value numeric,
  lower numeric,
  upper numeric,
  document text not null,
  url text not null,
  last_verified date not null,
  verification text not null,
  primary key (series_id, year, target_kind)
);

create table public.release_calendar (
  series_id text not null,
  ref_period text not null,
  release_date date not null,
  calendar_source text not null,
  primary key (series_id, ref_period)
);

create table public.site_status (
  id int primary key check (id = 1),
  last_success_at timestamptz not null,
  last_run_status text not null check (last_run_status in ('ok', 'partial', 'failed')),
  stale_sources text[] not null default '{}'
);

revoke all on table public.sources from anon, authenticated, service_role;
grant select on table public.sources to anon;
alter table public.sources enable row level security;
create policy "baca publik" on public.sources for select to anon using (true);

revoke all on table public.series_meta from anon, authenticated, service_role;
grant select on table public.series_meta to anon;
alter table public.series_meta enable row level security;
create policy "baca publik" on public.series_meta for select to anon using (true);

revoke all on table public.latest_values from anon, authenticated, service_role;
grant select on table public.latest_values to anon;
alter table public.latest_values enable row level security;
create policy "baca publik" on public.latest_values for select to anon using (true);

revoke all on table public.chart_series from anon, authenticated, service_role;
grant select on table public.chart_series to anon;
alter table public.chart_series enable row level security;
create policy "baca publik" on public.chart_series for select to anon using (true);

revoke all on table public.targets from anon, authenticated, service_role;
grant select on table public.targets to anon;
alter table public.targets enable row level security;
create policy "baca publik" on public.targets for select to anon using (true);

revoke all on table public.release_calendar from anon, authenticated, service_role;
grant select on table public.release_calendar to anon;
alter table public.release_calendar enable row level security;
create policy "baca publik" on public.release_calendar for select to anon using (true);

revoke all on table public.site_status from anon, authenticated, service_role;
grant select on table public.site_status to anon;
alter table public.site_status enable row level security;
create policy "baca publik" on public.site_status for select to anon using (true);
