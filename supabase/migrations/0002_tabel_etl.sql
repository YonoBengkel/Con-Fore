-- 0002: tabel kerja pipeline di skema etl (tidak terbuka ke Data API).

create table etl.sources (
  source_id text primary key,
  name text not null,
  url text not null,
  terms_url text not null,
  license text not null,
  attribution_text text not null
);

create table etl.series (
  series_id text primary key,
  source_id text not null references etl.sources,
  country text not null default 'IDN',
  dataset text not null,
  source_key text,
  frequency text not null check (frequency in ('A', 'Q', 'M', 'D')),
  unit text not null,
  concept text not null
    check (concept in ('level', 'index', 'yoy', 'avg_yoy', 'eop_yoy', 'rate', 'round_rate')),
  base_year int,
  is_target boolean not null default false,
  name_id text not null,
  citation text not null,
  active boolean not null default true
);

create table etl.observations (
  series_id text not null references etl.series,
  period text not null check (period ~ '^\d{4}(-Q[1-4]|-\d{2}(-\d{2})?)?$'),
  vintage_date date not null,
  period_start date not null,
  value numeric,  -- NULL: periode ini ditarik sumber pada vintage_date
  release_date date,
  source_id text not null references etl.sources,
  source_status text,
  seen_at timestamptz not null default now(),
  primary key (series_id, period, vintage_date)
);

create table etl.targets (
  series_id text not null references etl.series,
  year int not null,
  target_kind text not null check (target_kind in ('apbn', 'pmk', 'rpjmn')),
  value numeric,
  lower numeric,
  upper numeric,
  document text not null,
  url text not null,
  last_verified date not null,
  verification text not null check (verification in ('dokumen', 'berita')),
  primary key (series_id, year, target_kind),
  check (value is not null or (lower is not null and upper is not null)),
  check (lower is null or upper is null or lower <= upper)
);

create table etl.release_calendar (
  series_id text not null references etl.series,
  ref_period text not null,
  calendar_source text not null,
  release_date date not null,
  primary key (series_id, ref_period, calendar_source)
);

create table etl.runs (
  run_id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null check (trigger in ('schedule', 'release', 'push', 'dispatch', 'laptop')),
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  git_sha text
);

-- Tidak pernah menyimpan URL atau teks error bebas: error hanya kode HTTP atau nama jenis error.
create table etl.fetch_log (
  id bigint generated always as identity primary key,
  run_id bigint not null references etl.runs,
  series_id text not null references etl.series,
  source_id text not null,
  http_status int,
  error text,
  data_hash text,
  n_rows int,
  max_period text,
  changed boolean,
  fetched_at timestamptz not null default now()
);

create index fetch_log_series_time on etl.fetch_log (series_id, fetched_at desc);

-- Tutup juga tabel dan sequence etl secara eksplisit, apa pun default privileges global proyeknya.
revoke all on all tables in schema etl from anon, authenticated, service_role;
revoke all on all sequences in schema etl from anon, authenticated, service_role;
