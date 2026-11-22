-- 0006: data tampilan fase 6 (PRD 4.1 dan 4.4). Sama seperti 0003 dan 0005: hanya SELECT untuk anon,
-- RLS menyala, dan isinya dibangun ulang setiap publikasi dengan DELETE + INSERT.

-- Hari pertama Con-Fore menyimpan seri itu: sejak hari itu setiap versinya tercatat, jadi revisi
-- sebelumnya tidak terekam. Kosong untuk seri turunan, yang revisinya mengikuti seri asalnya.
alter table public.series_meta add column versions_since date;

-- Batas rentang 80% perkiraan yang dinilai, untuk menghitung berapa perkiraan jatuh di dalam rentangnya.
alter table public.track_record add column lo80 numeric, add column hi80 numeric;

-- Versi yang mengubah angka tampil satu periode, sesudah dibulatkan seperti di situs: angka lama, angka
-- baru, hari Con-Fore melihat angka baru, dan tanggal rilisnya bila sumber mencatatnya.
create table public.revisions (
  series_id text not null,
  period text not null,
  vintage_date date not null,
  old_value numeric not null,
  new_value numeric not null,
  release_date date,
  primary key (series_id, period, vintage_date)
);

revoke all on table public.revisions from anon, authenticated, service_role;
grant select on table public.revisions to anon;
alter table public.revisions enable row level security;
create policy "baca publik" on public.revisions for select to anon using (true);
