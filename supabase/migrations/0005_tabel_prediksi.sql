-- 0005: tabel siap tampil untuk tab Prediksi. Sama seperti 0003: hanya SELECT untuk anon, RLS menyala,
-- dan isinya dibangun ulang dengan DELETE + INSERT, supaya GRANT dan RLS tidak hilang.

-- Ramalan terbaru semua model. is_main menandai angka utama per horizon, dari hasil backtest (PRD 6).
create table public.forecast_latest (
  series_id text not null,
  ref_period text not null,
  model text not null,
  is_main boolean not null,
  horizon int not null,
  point numeric not null,
  lo80 numeric,
  hi80 numeric,
  origin_date date not null,
  primary key (series_id, ref_period, model)
);

-- Ringkasan etl.backtest per horizon dan jendela penilaian.
create table public.backtest_scores (
  series_id text not null,
  model text not null,
  horizon int not null,
  window_name text not null check (window_name in ('normal', 'sebelum', 'uji', 'semua')),
  is_main boolean not null,
  mae numeric not null,
  rmse numeric not null,
  n int not null,
  primary key (series_id, model, horizon, window_name)
);

-- Ramalan sungguhan yang periodenya sudah terbit: ramalan terakhir sebelum rilis, per model.
create table public.track_record (
  series_id text not null,
  ref_period text not null,
  model text not null,
  origin_date date not null,
  is_main boolean not null,
  forecast numeric not null,
  first_release_actual numeric not null,
  latest_actual numeric not null,
  abs_error numeric not null,
  primary key (series_id, ref_period, model, origin_date)
);

revoke all on table public.forecast_latest from anon, authenticated, service_role;
grant select on table public.forecast_latest to anon;
alter table public.forecast_latest enable row level security;
create policy "baca publik" on public.forecast_latest for select to anon using (true);

revoke all on table public.backtest_scores from anon, authenticated, service_role;
grant select on table public.backtest_scores to anon;
alter table public.backtest_scores enable row level security;
create policy "baca publik" on public.backtest_scores for select to anon using (true);

revoke all on table public.track_record from anon, authenticated, service_role;
grant select on table public.track_record to anon;
alter table public.track_record enable row level security;
create policy "baca publik" on public.track_record for select to anon using (true);
