-- 0004: hasil model di skema etl (tidak terbuka ke Data API). Tampilan publik menyusul di fase 4.

-- Ramalan sungguhan, untuk dinilai kelak. Angka hari lain tidak pernah berubah, dan run kedua di hari
-- yang sama mengganti seluruh ramalan hari itu.
create table etl.forecasts (
  series_id text not null references etl.series,
  ref_period text not null check (ref_period ~ '^\d{4}(-Q[1-4]|-\d{2})$'),
  model text not null,
  origin_date date not null,
  stat text not null check (stat in ('point', 'lo80', 'hi80', 'lo95', 'hi95')),
  value numeric not null,
  data_cutoff date not null,  -- awal periode angka resmi terakhir target saat ramalan dibuat
  input_hash text not null,  -- sidik semua yang memengaruhi ramalan: dibuat ulang hanya bila ini berubah
  git_sha text,
  pkg_versions jsonb not null,
  created_at timestamptz not null default now(),
  primary key (series_id, ref_period, model, origin_date, stat)
);

create index forecasts_created on etl.forecasts (created_at desc);

-- Hasil backtest terakhir: diganti penuh setiap kali backtest berjalan, dan menjadi sumber lebar rentang.
create table etl.backtest (
  series_id text not null references etl.series,
  model text not null,
  origin_date date not null,
  ref_period text not null check (ref_period ~ '^\d{4}(-Q[1-4]|-\d{2})$'),
  horizon int not null check (horizon > 0),
  forecast numeric not null,
  actual numeric not null,
  git_sha text,
  computed_at timestamptz not null default now(),
  primary key (series_id, model, origin_date, ref_period)
);

revoke all on table etl.forecasts, etl.backtest from anon, authenticated, service_role;
