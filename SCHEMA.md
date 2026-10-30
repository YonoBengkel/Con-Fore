Status: sesuai migrasi `0001`-`0003` (2026-10-30). Tabel bertanda fase 3 dan 4 masih rencana.

# Skema Database Con-Fore

Database Supabase Postgres (paket Free) dengan dua skema:

| Skema | Isi | Terbuka ke Data API |
|---|---|---|
| `etl` | Data kerja pipeline: registri seri dan sumber, observasi dengan vintage, log, forecast | Tidak |
| `public` | Tabel siap tampil yang dibangun ulang setiap publikasi | Ya, hanya SELECT untuk peran `anon` |

Yang menulis hanya pipeline (peran `postgres` lewat session pooler). Situs hanya membaca `public` lewat server Vercel. Alur datanya ada di [ARCHITECTURE.md](ARCHITECTURE.md). Semua SQL pipeline memakai nama berskema (`etl.x`, `public.x`), karena beberapa nama tabel ada di kedua skema.

## 1. ERD

### 1.1 Skema `etl`

Relasi di skema ini dideklarasikan sebagai foreign key.

```mermaid
erDiagram
  SOURCES ||--o{ SERIES : "menerbitkan"
  SERIES ||--o{ OBSERVATIONS : "punya"
  SERIES ||--o{ TARGETS : "punya target"
  SERIES ||--o{ RELEASE_CALENDAR : "dijadwalkan"
  SERIES ||--o{ FORECASTS : "diramal (fase 3)"
  SERIES ||--o{ BACKTEST : "diuji (fase 3)"
  RUNS ||--o{ FETCH_LOG : "mencatat"
  SERIES ||--o{ FETCH_LOG : "diambil"
  SOURCES {
    text source_id PK
    text name
    text url
    text terms_url
    text license
    text attribution_text
  }
  SERIES {
    text series_id PK
    text source_id FK
    text country
    text dataset
    text source_key
    text frequency
    text unit
    text concept
    int base_year
    boolean is_target
    text name_id
    text citation
    boolean active
  }
  OBSERVATIONS {
    text series_id PK, FK
    text period PK
    date vintage_date PK
    date period_start
    numeric value
    date release_date
    text source_id
    text source_status
    timestamptz seen_at
  }
  TARGETS {
    text series_id PK, FK
    int year PK
    text target_kind PK
    numeric value
    numeric lower
    numeric upper
    text document
    text url
    date last_verified
    text verification
  }
  RELEASE_CALENDAR {
    text series_id PK, FK
    text ref_period PK
    text calendar_source PK
    date release_date
  }
  FORECASTS {
    text series_id PK, FK
    text ref_period PK
    text model PK
    date origin_date PK
    text stat PK
    numeric value
    date data_cutoff
    text git_sha
    jsonb pkg_versions
  }
  BACKTEST {
    text series_id PK, FK
    text model PK
    date origin_date PK
    text ref_period PK
    int horizon
    numeric forecast
    numeric actual
  }
  RUNS {
    bigint run_id PK
    timestamptz started_at
    timestamptz finished_at
    text trigger
    text status
    text git_sha
  }
  FETCH_LOG {
    bigint id PK
    bigint run_id FK
    text series_id FK
    text source_id
    int http_status
    text error
    text data_hash
    int n_rows
    text max_period
    boolean changed
    timestamptz fetched_at
  }
```

`etl.schema_migrations` (versi dan waktu terap) berdiri sendiri, tanpa relasi.

### 1.2 Skema `public`

Semua tabel `public` diturunkan dari `etl` dan dihubungkan lewat `series_id`. Relasinya **logis saja, tidak dideklarasikan sebagai foreign key**, karena seluruh skema diisi ulang dalam satu transaksi.

```mermaid
erDiagram
  SOURCES ||--o{ SERIES_META : "atribusi"
  SERIES_META ||--o| LATEST_VALUES : "angka terbaru"
  SERIES_META }o--o{ CHART_SERIES : "ditampilkan di"
  SERIES_META ||--o{ TARGETS : "target resmi"
  SERIES_META ||--o{ RELEASE_CALENDAR : "rilis berikutnya"
  SERIES_META ||--o{ FORECAST_LATEST : "perkiraan (fase 4)"
  SERIES_META ||--o{ TRACK_RECORD : "rekam jejak (fase 4)"
  SOURCES {
    text source_id PK
    text name
    text url
    text terms_url
    text license
    text attribution_text
  }
  SERIES_META {
    text series_id PK
    text source_id
    text country
    text name_id
    text unit
    text concept
    text frequency
    text citation
    text last_period
    date last_release_date
    date next_release_date
  }
  LATEST_VALUES {
    text series_id PK
    text period
    numeric value
    numeric previous_value
    date release_date
    date seen_date
    text source_id
    boolean is_stale
  }
  CHART_SERIES {
    text chart_id PK
    text[] series_ids
    jsonb points
    timestamptz updated_at
  }
  TARGETS {
    text series_id PK
    int year PK
    text target_kind PK
    numeric value
    numeric lower
    numeric upper
    text document
    text url
    date last_verified
    text verification
  }
  RELEASE_CALENDAR {
    text series_id PK
    text ref_period PK
    date release_date
    text calendar_source
  }
  FORECAST_LATEST {
    text series_id PK
    text ref_period PK
    text kind PK
    text model_label
    numeric point
    numeric lo80
    numeric hi80
    date origin_date
  }
  TRACK_RECORD {
    text series_id PK
    text ref_period PK
    text model PK
    date origin_date PK
    numeric forecast
    numeric first_release_actual
    numeric latest_actual
    numeric abs_error
  }
  SITE_STATUS {
    int id PK
    timestamptz last_success_at
    text last_run_status
    text[] stale_sources
  }
```

## 2. Tabel dan constraint

### 2.1 Skema `etl`

| Tabel | Kunci | Constraint dan catatan |
|---|---|---|
| `sources` | `source_id` | Nama, URL portal data, URL halaman syarat (`terms_url`), ringkasan lisensi, dan kalimat atribusi wajib per sumber. Dimuat dari `config/sources.csv`. |
| `series` | `series_id` | FK `source_id`. `frequency` in (`A`,`Q`,`M`,`D`). `concept` in (`level`,`index`,`yoy`,`avg_yoy`,`eop_yoy`,`rate`,`round_rate`), supaya hanya konsep yang sama yang dibandingkan (contoh: sasaran inflasi dengan `eop_yoy`). `country` default `IDN` (`WLD` untuk harga dunia). `source_key` berisi query API, kosong untuk seri turunan (`dataset` = `turunan`). Dimuat dari `config/series.toml`; seri yang dihapus dari registri menjadi `active = false`. |
| `observations` | (`series_id`, `period`, `vintage_date`) | `period` berformat `YYYY`, `YYYY-Qn`, `YYYY-MM`, atau `YYYY-MM-DD`; `period_start` (date, not null) untuk pengurutan. `vintage_date` = tanggal WIB saat nilai pertama kali terlihat. `value` NULL berarti periode itu ditarik sumber pada `vintage_date` (tidak tampil sampai sumber memuatnya lagi). `source_id` mencatat asal nilai (BPS, IMF, manual) agar rekam jejak hanya dinilai terhadap rilis pertama BPS. `release_date` belum diisi pipeline untuk sumber mana pun: IMF tidak mencantumkan tanggal rilis BPS, dan WebAPI BPS hanya memberi tanggal pembaruan per variabel, bukan per observasi. `source_status` = kode status observasi dari sumber, bila ada. |
| `targets` | (`series_id`, `year`, `target_kind`) | `target_kind` in (`apbn`,`pmk`,`rpjmn`): lensa target memakai APBN (pertumbuhan, TPT) dan PMK (inflasi); panel jangka panjang memakai RPJMN. Isi `value`, atau `lower` dan `upper` untuk rentang (TPT hanya rentang). `document`, `url`, `last_verified` wajib diisi; `verification` in (`dokumen`,`berita`) menandai apakah angkanya sudah dicocokkan ke dokumen resmi. Diganti penuh dari `config/targets.csv` setiap run. |
| `release_calendar` | (`series_id`, `ref_period`, `calendar_source`) | `calendar_source` misalnya `bps`, `oecd`, `bi-rdg`. Diganti penuh dari `config/release_calendar.csv` setiap run. |
| `forecasts` (fase 3) | (`series_id`, `ref_period`, `model`, `origin_date`, `stat`) | `stat` in (`point`,`lo80`,`hi80`,`lo95`,`hi95`). Hanya ditambah, tidak pernah ditimpa. `git_sha` dan `pkg_versions` mencatat kode dan versi paket yang menghasilkannya. |
| `backtest` (fase 3) | (`series_id`, `model`, `origin_date`, `ref_period`) | `horizon` dalam satuan periode seri. Sumber lebar rentang ketidakpastian. |
| `runs` | `run_id` (identity) | `trigger` in (`schedule`,`release`,`push`,`dispatch`,`laptop`); `status` in (`running`,`ok`,`partial`,`failed`). |
| `fetch_log` | `id` (identity) | Satu baris per seri per run. FK `run_id` dan `series_id`. Tidak pernah menyimpan URL (key BPS ada di path URL) atau teks error bebas: `error` hanya kode tetap seperti `HTTP 503` atau nama jenis error. `data_hash` adalah SHA-256 data ternormalisasi (periode dan nilai); `changed` membandingkannya dengan hash terakhir seri itu. |
| `schema_migrations` | `version` | Diisi oleh `python -m confore migrate`. |

`config/holidays.csv` (fase 3) akan dibaca langsung oleh model dan tidak disimpan di database, karena berkasnya ada di repo.

### 2.2 Skema `public`

| Tabel | Kunci | Catatan |
|---|---|---|
| `sources` | `source_id` | Untuk halaman Sumber data, termasuk kalimat atribusi wajib |
| `series_meta` | `series_id` | Nama Indonesia, satuan, sumber, sitasi, periode terakhir, tanggal rilis terakhir dan berikutnya |
| `latest_values` | `series_id` | Angka terbaru per seri beserta pembandingnya, untuk kartu dan kalimat ringkasan: angka periode sebelumnya, atau untuk TPT per ronde Sakernas (`round_rate`) ronde bulan yang sama tahun sebelumnya. `seen_date` = tanggal nilai itu pertama terlihat; `is_stale` = pengambilan terakhir seri itu (atau inputnya, untuk seri turunan) gagal, atau seri itu belum pernah berhasil diambil |
| `chart_series` | `chart_id` | Satu baris per grafik. Satu grafik bisa memuat beberapa seri (`series_ids`), dan `points` berupa objek JSON berisi array `[periode, nilai]` per seri. Dipilih karena Data API memotong jawaban di 1.000 baris secara diam-diam. Juga sumber unduhan CSV |
| `targets` | (`series_id`, `year`, `target_kind`) | Salinan target resmi beserta status `verification`; sebelum rilis publik, baris `berita` dicocokkan dulu ke dokumen resmi |
| `release_calendar` | (`series_id`, `ref_period`) | Hanya rilis yang belum lewat (tanggal WIB). Bila beberapa kalender mencatat periode yang sama, yang dipakai tanggal paling awal. `calendar_source` ikut tampil, karena selama data berasal dari salinan IMF, tanggal BPS adalah tanggal rilis BPS, bukan tanggal angka itu muncul di situs |
| `site_status` | `id` (check `id = 1`) | Satu baris: `last_success_at` (waktu publikasi terakhir dari run yang tidak gagal; run gagal tidak memajukannya), `last_run_status` (`ok`, `partial`, atau `failed`; run yang berhenti karena error juga menandai `failed`), dan kode sumber yang terlambat. Hanya kode tetap, bukan teks bebas |
| `forecast_latest` (fase 4) | (`series_id`, `ref_period`, `kind`) | `kind` in (`con-fore`,`baseline`,`imf-weo`); yang tampil sebagai angka utama ditandai dari hasil backtest |
| `track_record` (fase 4) | (`series_id`, `ref_period`, `model`, `origin_date`) | Perkiraan dibanding rilis pertama dan angka terbaru |

## 3. Penulisan dan idempotensi

**Observasi.** Bila hash data sebuah seri sama dengan hash terakhirnya di `etl.fetch_log`, tidak ada yang ditulis. Bila berbeda, data baru di-`COPY` ke tabel sementara `tmp_obs`, lalu ditulis dengan satu perintah. Baris baru hanya masuk bila nilainya berbeda dari vintage terakhir, sehingga menjalankan ulang di hari mana pun tidak menambah salinan:

```sql
insert into etl.observations (series_id, period, vintage_date, period_start, value,
                              release_date, source_id, source_status, seen_at)
select s.series_id, s.period, s.vintage_date, s.period_start, s.value,
       s.release_date, s.source_id, s.source_status, now()
from tmp_obs s
left join lateral (
  select o.value from etl.observations o
  where o.series_id = s.series_id and o.period = s.period
  order by o.vintage_date desc
  limit 1
) last on true
where last.value is distinct from s.value
on conflict (series_id, period, vintage_date) do update
  set value = excluded.value, seen_at = now()
  where etl.observations.value is distinct from excluded.value;
```

Koreksi di hari yang sama menimpa nilai hari itu. Bila koreksinya mengembalikan nilai ke vintage sebelumnya, baris hari itu dihapus lebih dulu (perintah `delete` di `confore/db.py`, `write_observations`) supaya tidak ada vintage kembar. Observasi dan baris `fetch_log`-nya ditulis dalam satu transaksi per seri, jadi satu seri yang gagal tidak membatalkan seri lain.

**Periode yang ditarik sumber.** Sebelum perintah di atas, periode yang masih tampil tetapi tidak ada lagi di jawaban sumber ditambahkan ke `tmp_obs` dengan nilai NULL, jadi penarikan menjadi vintage NULL lewat jalur yang sama. Perbandingan memakai `is distinct from`, sehingga penarikan yang dibatalkan di hari yang sama juga menghapus baris hari itu. Bila lebih dari `max(5, 10% periode tampil)` hilang sekaligus, pengambilan dicatat sebagai error dan tidak ditulis, kecuali mode `full_refresh`.

**Seri turunan** (pertumbuhan yoy, kurs silang) dihitung di memori dari vintage terbaru saat publikasi dan tidak disimpan di `etl.observations`.

**Satu penulis.** Run dan migrasi mengambil kunci advisory sesi (`pg_try_advisory_lock`); run kedua yang datang bersamaan berhenti tanpa menulis.

**Publikasi** (`confore/publish.py`). Semua tabel `public` diisi ulang dalam **satu transaksi** dengan `DELETE` lalu `INSERT`. `chart_series` saat ini berisi satu grafik per seri (`chart_id` = `series_id`). Jangan pernah `DROP TABLE`, `CREATE TABLE AS`, atau `to_sql(if_exists='replace')`, karena cara itu membuat tabel baru tanpa GRANT, kebijakan, dan RLS.

**Ganti tahun dasar.** Buat `series_id` baru dengan `base_year` sendiri; seri lama dibekukan (`active = false`).

**Backup.** Ekspor mingguan dibaca dalam satu transaksi `REPEATABLE READ` (atau `pg_dump`), supaya semua tabel berasal dari snapshot yang sama.

## 4. Kebijakan akses

| Peran | Dipakai oleh | Hak |
|---|---|---|
| `postgres` | Pipeline lewat session pooler | Penuh atas `etl` dan `public` |
| `anon` | Server Vercel (publishable key) | Hanya SELECT pada tabel `public` |
| `authenticated` | Tidak dipakai (tidak ada login) | Tidak ada |
| `service_role` / secret key | Tidak dipakai di MVP | Tidak ada |

Migrasi awal (`0001`) menutup akses bawaan. Pernyataan global terakhir berlaku untuk semua skema, termasuk `etl`; itu aman karena pipeline berjalan sebagai pemilik (`postgres`) dan kebijakan RLS tidak memakai fungsi bantu.

```sql
create schema if not exists etl;
revoke all on schema etl from public, anon, authenticated, service_role;
revoke create on schema public from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres
  revoke execute on functions from public;
```

Pola untuk **setiap** tabel `public` (contoh `latest_values`). Perintah `revoke` ditulis eksplisit supaya hasilnya sama, apa pun tanggal tabel itu dibuat terhadap perubahan Data API Supabase 2026-10-30:

```sql
revoke all on table public.latest_values from anon, authenticated, service_role;
grant select on table public.latest_values to anon;
alter table public.latest_values enable row level security;
create policy "baca publik" on public.latest_values
  for select to anon using (true);
```

Aturan tambahan:

- Fungsi bantu dibuat di skema `etl`, tidak di `public`, supaya tidak bisa dipanggil lewat `/rest/v1/rpc`.
- Tidak ada view di `public`, kecuali ditulis persis `with (security_invoker = true)`.
- Proyek Supabase baru membawa event trigger `ensure_rls` (fungsi `public.rls_auto_enable`) yang menyalakan RLS otomatis untuk tabel baru di `public`. Migrasi tetap menyalakan RLS secara eksplisit, jadi hasilnya sama di Postgres lokal.

**Pemeriksaan katalog** (`confore/db.py`, `check_access`), dijalankan sebelum setiap run menulis dan di dalam transaksi setiap migrasi (migrasi yang membuka akses dibatalkan). Semua query harus mengembalikan 0 baris; kalau tidak, run berhenti. Inti query-nya di bawah; versi di kode juga memeriksa hak kolom `authenticated`, sequence di `public` dan `etl`, hak `anon` dan `authenticated` atas tabel `etl`, default privileges milik `postgres` di `public` dan `etl` yang memberi hak ke `anon` atau `authenticated`, fungsi yang bisa dipanggil `authenticated` (fungsi bertipe `trigger` atau `event_trigger` dikecualikan karena tidak bisa dipanggil langsung maupun lewat RPC; contohnya `public.rls_auto_enable` bawaan Supabase), `USAGE` pada skema `etl`, dan `CREATE` pada skema `etl` dan `public`. Migrasi `0002` juga mencabut eksplisit semua hak atas tabel dan sequence `etl`.

```sql
-- tabel, view, dan materialized view di public yang aksesnya salah
select c.relname, c.relkind
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
  and ((c.relkind in ('r','p') and not c.relrowsecurity)
    or not has_table_privilege('anon', c.oid, 'SELECT')
    or has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('anon', c.oid, 'INSERT,UPDATE,REFERENCES')
    or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or (c.relkind in ('r','p') and not exists (
          select 1 from pg_policies p
          where p.schemaname = n.nspname and p.tablename = c.relname
            and p.cmd in ('SELECT','ALL') and p.permissive = 'PERMISSIVE'
            and p.roles && array['anon','public']::name[]))
    or c.relkind in ('m','f')
    or (c.relkind = 'v'
        and not coalesce(c.reloptions @> array['security_invoker=true'], false)));

-- fungsi di public yang bisa dipanggil anon
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
```

Pada Postgres 17, `MAINTAIN` ditambahkan ke kedua daftar hak tabel (kode memilihnya otomatis dari versi server).

**Setelah migrasi**, pipeline (mode `migrate`) menguji Data API dengan publishable key bila `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` terisi: SELECT pada `public.site_status` berhasil; INSERT ke `public.sources` ditolak; permintaan ke skema `etl` ditolak. RPC tidak diuji lewat API karena `public` tidak punya fungsi; cek katalog sudah menolak fungsi yang bisa dipanggil `anon`.

**Koneksi pipeline** wajib TLS (`sslmode=require`) kecuali string koneksi menyebut `sslmode` sendiri, misalnya `verify-full` dengan sertifikat CA Supabase, atau `disable` untuk Postgres lokal.

## 5. Migrasi

- Letak: `supabase/migrations/NNNN_nama.sql`, berurutan dan tidak pernah diubah setelah diterapkan.
- Diterapkan oleh `python -m confore migrate` (lokal atau workflow dengan mode `migrate`), yang mencatat versinya di `etl.schema_migrations`.
- Yang ada: `0001_skema_dan_akses_dasar` (skema `etl`, `etl.schema_migrations`, penutupan akses bawaan), `0002_tabel_etl`, `0003_tabel_public` (beserta GRANT, RLS, dan kebijakan). Fase 3 dan 4 menambah tabel forecast dan backtest.
- `migrate` lalu menjalankan pemeriksaan katalog (bagian 4) dan, bila `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` terisi, uji Data API dengan publishable key.
- Uji lokal: `tests/test_db.py` memasang default privileges lama Supabase (tabel baru terbuka untuk `anon`, `authenticated`, `service_role`), menerapkan semua migrasi ke Postgres lokal sekali pakai (`CONFORE_TEST_DB_URL` sebagai variabel environment; hanya alamat mesin ini dan database berakhiran `_test`), lalu memeriksa bahwa tabel baru tidak lagi terbuka, katalog akses, vintage dan penarikan periode, status run, kunci, publikasi, dan hak `anon`.

## 6. Ukuran

- Batas paket Free: 500 MB. Pipeline memberi peringatan di 300 MB.
- Perkiraan kasar (belum diukur): puluhan seri dikali ratusan periode dikali beberapa vintage, jadi masih di bawah ratusan ribu baris dan beberapa MB.
- Berkas mentah dari sumber tidak disimpan di database.
