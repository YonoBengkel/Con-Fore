Status: bagian pipeline data sesuai kode fase 1 (2026-10-30); situs, model, jadwal otomatis, backup, dan pemantauan masih rencana yang disetujui pengelola 2026-10-30.

# Arsitektur Con-Fore

Rancangan teknis untuk MVP di [PRD.md](PRD.md). Skema database ada di [SCHEMA.md](SCHEMA.md). Dokumen ini menggantikan `docs/ARSITEKTUR.md`.

## 1. Komponen dan alur data

Tidak ada server backend yang menyala terus. Data berubah beberapa kali sebulan dan model berjalan per batch, jadi tidak perlu server yang menunggu pengunjung.

| Komponen | Analogi | Tugas |
|---|---|---|
| GitHub Actions | Dapur | Mengambil data, mengolah, menghitung model, menulis ke Supabase. Tidak melayani pengunjung. |
| Supabase (Postgres + Data API) | Gudang + loket | Menyimpan data; Data API bawaannya dibaca server Vercel. |
| Vercel (Next.js) | Etalase | Menyajikan halaman dari cache. Browser pengunjung tidak pernah memanggil Supabase. |
| cron-job.org | Satpam | Mengecek kesehatan situs dan menyalakan ulang workflow setiap hari. |

```
Sumber API -> cek perubahan -> unduh -> validasi -> etl.observations (dengan vintage)
                                                 -> etl.fetch_log
etl.observations -> turunan (di memori) -> [fase 3: model -> etl.forecasts]
                 -> publikasi satu transaksi -> public.* (hanya-baca)
public.* -> server Vercel (ISR, cache) -> pengunjung
```

Semua logika ada di satu paket Python, `confore`, yang bisa dijalankan sama persis di GitHub Actions, di laptop, atau di runner cadangan.

## 2. Peta folder

Yang sudah ada ditandai `[ada]`; sisanya rencana.

```
Con-Fore/
  README.md  PRD.md  ARCHITECTURE.md  SCHEMA.md  RUNBOOK.md   [ada]
  .gitignore  .env.example                                    [ada]
  requirements.in        dependensi langsung (psycopg)        [ada]
  requirements.txt       lockfile berhash dari `uv pip compile` [ada]
  confore/               paket Python
    smoke.py             uji akses setiap sumber, satu permintaan kecil per sumber   [ada]
    config.py            muat dan periksa config/ (seri, sumber, target, kalender)   [ada]
    fetch.py             pengambil generik CSV SDMX (IMF, BIS, OECD, ECB): retry, normalisasi periode, hash   [ada]
    derive.py            turunan di memori: yoy, rasio (kurs silang)   [ada]
    db.py                migrasi, cek katalog akses, uji Data API, tulis vintage, log   [ada]
    publish.py           isi ulang tabel public.* dalam satu transaksi   [ada]
    cli.py               perintah: migrate, run (--dry-run, --source, --trigger, --full-refresh)   [ada]
    models/              baseline, DFM PDB, inflasi, TPT (fase 3)
  supabase/migrations/   0001-0003: skema, tabel, GRANT, RLS   [ada]
  config/
    series.toml          registri seri dan query API   [ada]
    sources.csv          nama, URL, syarat, lisensi, dan kalimat atribusi per sumber   [ada]
    targets.csv          target resmi bersumber, dengan status verifikasi   [ada]
    release_calendar.csv kalender rilis   [ada]
    holidays.csv         hari libur dan Ramadan/Lebaran (fase 3, saat model memakainya)
  web/                   Next.js (App Router)
  tests/                 test_smoke.py, test_pipeline.py, test_db.py (Postgres lokal)   [ada]
  .github/
    dependabot.yml       pembaruan bulanan untuk action yang dipin   [ada]
    workflows/           smoke.yml, pipeline.yml [ada]; nanti backup.yml, ci.yml
  docs/                  catatan metodologi (tanpa data asli)
```

Rencana awal memakai satu modul per sumber di `confore/sources/`. Karena keempat sumber tanpa key menjawab dalam CSV SDMX yang sama, cukup satu pengambil generik; sumber berformat lain (BPS, FRED) menambah fungsi parser sendiri saat dipakai. Registri memakai TOML (bukan YAML) karena `tomllib` ada di pustaka standar.

## 3. Cara menjalankan

Lokal, dengan `.env` berisi variabel di bawah (`.env` masuk `.gitignore` sejak commit pertama) dan dependensi dari `requirements.txt` (lihat README):

```
python -m confore migrate          # terapkan migrasi SQL yang belum jalan, lalu cek katalog dan uji Data API
python -m confore run --dry-run    # ambil semua seri dan hitung turunan tanpa database
python -m confore run              # ambil, cek akses, simpan vintage baru, publikasi public.*
python -m confore run --source imf # hanya ambil satu sumber; publikasi tetap untuk semua seri
cd web && npm run dev              # (fase 2) situs lokal membaca Supabase
```

Urutan satu `run`: muat dan periksa `config/`, ambil setiap seri dengan jeda 1 detik (sebelum koneksi database dibuka, supaya koneksi tidak menganggur saat sumber lambat), buka koneksi, ambil kunci advisory (run atau migrasi lain yang sedang berjalan membuat run ini berhenti), cek katalog akses (berhenti bila ada akses yang tidak aman) dan ukuran database, catat baris `etl.runs`, salin `config/` ke `etl`, tulis vintage baru dan `fetch_log` per seri, tentukan status, publikasi, lalu tutup baris run. Revalidasi situs ditambahkan di fase 2.

| Variabel | Dipakai oleh | Isi |
|---|---|---|
| `SUPABASE_DB_URL` | Pipeline | String koneksi **session pooler** (berisi password database) |
| `BPS_API_KEY`, `FRED_API_KEY` | Pipeline | Key gratis; BPS setelah terdaftar, FRED nanti |
| `REVALIDATE_SECRET` | Pipeline dan Vercel | Rahasia bersama untuk `/api/revalidate` |
| `HEALTH_TOKEN` | Vercel dan cron-job.org | Token header untuk `/api/health` |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Vercel (hanya server); pipeline untuk uji akses setelah migrasi | Alamat proyek dan kunci publik |
| `SITE_URL` | Pipeline | Domain produksi situs |

Di GitHub, nilai ini disimpan sebagai Secrets (`pipeline.yml` hanya membaca Secrets). Di Vercel, sebagai Environment Variables. String session pooler disalin dari tombol Connect di dashboard Supabase (pilihan "Session pooler") langsung ke tempat-tempat itu, tidak pernah lewat chat atau commit.

## 4. Lapisan aplikasi

### 4.1 Front end

- Next.js App Router di runtime Node, di Vercel.
- Halaman: `/` (tab Data), `/prediksi`, `/indikator/[id]` (detail per target), `/cara-kerja`, `/sumber`.
- Data dibaca di server lalu dirender sebagai halaman statis yang di-cache (ISR). Browser hanya menerima HTML dan data grafik.
- Segitiga dua lensa digambar sebagai SVG; perhitungan lensa memakai data yang sudah ada di halaman, tanpa panggilan baru ke server.
- Unduh CSV dibuat di server dari `public.chart_series` lewat route `/api/csv/[chart_id]` yang di-cache bersama halaman.
- Banner "data mungkin belum diperbarui" dihitung di browser dari `last_success_at`, supaya tetap muncul walau Supabase sedang mati.
- Halaman `/sumber` menampilkan kalimat atribusi wajib per sumber dari `public.sources`.
- Bahasa Indonesia, mengutamakan HP, tema terang dan gelap. Kalimat ringkasan menjadi teks alternatif segitiga.

### 4.2 API

- **Tidak ada API buatan sendiri untuk data.** Server Vercel membaca Data API (PostgREST) bawaan Supabase dengan publishable key.
- Route milik situs:
  - `POST /api/revalidate`: dipanggil pipeline setelah publikasi; wajib header `x-revalidate-secret`.
  - `GET /api/health`: dipanggil cron-job.org; wajib header token; mengembalikan 503 bila run sukses terakhir lebih dari 36 jam lalu.
  - `GET /api/csv/[chart_id]`: unduhan CSV untuk pengunjung.
- Bila nanti butuh endpoint sendiri (misalnya kalkulator skenario): Vercel Functions Python di paket Hobby.

### 4.3 Data

**Sumber**

| Sumber | Data | Akses | Kapan data baru muncul | Cara mendeteksi data baru | Syarat | Fase |
|---|---|---|---|---|---|---|
| IMF WEO | PDB, inflasi akhir tahun (`PCPIEPCH`), pengangguran, proyeksi, vintage | `api.imf.org` SDMX, tanpa key | April dan Oktober | Kolom `PUBLICATION_DATE` | Wajib sitasi IMF; dilarang unduhan massal otomatis tanpa izin | MVP |
| IMF QNEA | PDB riil kuartalan, harga konstan (`IDN.B1GQ.Q.NSA.XDC.Q`) | sama | Menyusul BPS beberapa minggu | Periode terakhir + hash ternormalisasi (`UPDATE_DATE` tidak bisa dipercaya) | sama | MVP, lalu cadangan |
| IMF CPI | Inflasi bulanan yoy (`IDN.CPI._T.YOY_PCH_PA_PT.M`) | sama | Menyusul BPS sampai sekitar 3 minggu | sama | sama | MVP, lalu cadangan |
| IMF PCPS | Batu bara, CPO, nikel, Brent | sama | Minggu pertama setiap bulan | `updatedAfter`; jawaban kosong berarti tidak ada perubahan | sama | MVP |
| BIS | BI-Rate (`WS_CBPOL`), credit gap | `stats.bis.org` API v2, tanpa key | Kamis mingguan; data harian tertinggal sekitar 8 hari | `updatedAfter`; 404 kode 100 berarti tidak ada perubahan | Wajib sitasi BIS; IP bisa diblokir | MVP |
| OECD | CLI Indonesia dan Tiongkok (`DF_CLI`) | `sdmx.oecd.org`, tanpa key | Bulanan, 18.00 WIB; masuk API sekitar 4 jam kemudian | `updatedAfter` (404 berarti tidak ada perubahan) + hash, karena riwayat CLI direvisi tiap bulan | Wajib sitasi; maksimal 60 unduhan per jam; dilarang lewat VPN | MVP |
| ECB, Frankfurter | EUR/IDR dan EUR/USD untuk kurs silang model; kurs versi BI untuk tampilan | `data-api.ecb.europa.eu`, `api.frankfurter.dev` | Hari kerja sekitar 22.00 WIB | Tanggal kurs terakhir | Tanpa batas resmi | MVP |
| World Bank | Konteks tahunan (WDI, WGI) | `api.worldbank.org` v2 | Tidak teratur | Kolom `lastupdated` per sumber | CC BY 4.0 | MVP, konteks |
| BPS WebAPI | CPI, PDB, TPT, ekspor-impor, daftar rilis pers | Key gratis di path URL | CPI: hari kerja pertama, sekitar 11.00 WIB. PDB dan TPT: tanggal 5 Feb, Mei, Agu, Nov (Sakernas triwulanan sejak 2026) | Rilis pers baru bertanggal hari ini, atau periode baru di variabelnya. PDB: tarik ulang seluruh riwayat karena kuartal lama ikut direvisi. TPT: bandingkan hanya ronde bulan yang sama | Wajib kalimat atribusi BPS; situs tidak boleh terkesan resmi BPS; batas tidak dipublikasi (header `Ratelimit-*`) | Setelah key; syarat rilis v0.1 |
| `config/*` | Target resmi, sumber, kalender rilis, hari libur | Diisi manual di repo | Saat ada perubahan | Push ke `config/**` | - | MVP |
| FRED, BI SEKI, halaman BI-Rate, GDELT, Comtrade | Pelengkap | Key, HTML, atau batas ketat | - | - | - | Nanti |

Tidak dipakai: IMF DataMapper (menjawab 403) dan CSV grafik FRED (koneksi ditolak). Pipeline hanya menarik seri yang disebut di `config/series.toml`.

**Yang sudah jalan di fase 1:** IMF (WEO, QNEA, CPI, PCPS), BIS, OECD, dan ECB, 14 seri ditambah 2 turunan. Setiap run mengambil seri penuh sejak 2000 (jawaban kecil berkat `detail=dataonly`, kecuali WEO yang butuh kolom `LATEST_ACTUAL_ANNUAL_DATA`), lalu membandingkan hash data ternormalisasi dengan pengambilan terakhir. Kolom "Cara mendeteksi data baru" di atas (`updatedAfter`, 404 sebagai "tidak ada perubahan") adalah optimasi yang belum dipakai. Frankfurter dan World Bank baru dipakai di uji akses.

**Jadwal penarikan**

Cron di GitHub Actions ditulis dalam **UTC** (bawaan; kunci `timezone` juga tersedia, tetapi tidak dipakai supaya konversinya selalu tertulis). WIB = UTC + 7, tanpa musim panas. Semua logika tanggal di kode memakai zona `Asia/Jakarta`.

| Run | Cron (UTC) | Waktu WIB | Isi |
|---|---|---|---|
| Harian | `17 23 * * *` | 06.17, **tanggal WIB = tanggal UTC + 1** | Cek perubahan semua sumber; ambil yang berubah; model bila input berubah; publikasi |
| Hari rilis BPS | `17 8,11 1-8 * *` | 15.17 dan 18.17, tanggal 1-8 (tanggal UTC = tanggal WIB) | Hanya cek BPS, beberapa jam setelah rilis sekitar 11.00 WIB; aktif setelah key BPS terbukti jalan |
| Push `config/**` | - | Saat tabel manual diubah | Muat ulang tabel manual dan publikasi |
| Manual | `workflow_dispatch` | Kapan saja | Mode `run`, `full_refresh`, `migrate` |
| Backup | `47 23 * * 0` | Senin 06.47 | Ekspor mingguan (lihat 4.13) |
| Kesehatan (cron-job.org) | - | 09.17 setiap hari | `GET /api/health`; email ke pengelola bila 503 |
| Penyalaan ulang (cron-job.org) | - | Setiap hari | `PUT .../actions/workflows/pipeline.yml/enable` |

Menit 17 dan 47 dipilih karena awal jam adalah waktu tersibuk GitHub, dan saat beban tinggi job terjadwal bisa tertunda atau dibatalkan. Tes otomatis memeriksa konversi ini di batas tengah malam.

Jadwal tabel manual: target diperiksa saat UU APBN baru disahkan (akhir September); kalender BPS dan jadwal RDG BI saat terbit (Desember-Januari); hari libur saat SKB tiga menteri terbit (September).

**Aturan inti**

- Perubahan dideteksi dari hash data yang dinormalisasi (seri, periode, nilai), bukan hash berkas mentah.
- Revisi menjadi baris vintage baru. Tampilan memakai vintage terbaru; rekam jejak dinilai terhadap rilis pertama BPS.
- Konsep dicatat per seri (rata-rata tahunan, akhir tahun, per ronde Sakernas) supaya yang dibandingkan selalu sepadan.
- Saat BPS mengganti tahun dasar, seri baru dibuat dan seri lama dibekukan; model memakai laju pertumbuhan.
- Tulis massal: `COPY` ke tabel sementara, lalu satu `INSERT ... SELECT` dalam satu transaksi (pola lengkap di SCHEMA.md). Semua SQL memakai nama berskema (`etl.x`, `public.x`).
- Periode yang ditarik sumber (hilang dari jawaban, atau berubah menjadi `NaN`) dicatat sebagai vintage bernilai NULL dan tidak tampil lagi; riwayatnya tetap tersimpan, dan nilainya kembali tampil bila sumber memuatnya lagi. Rem pengaman: bila dalam satu pengambilan lebih dari 5 periode atau 10% periode hilang, pengambilan itu dicatat sebagai error "terlalu banyak periode hilang" dan tidak ditulis.
- Mode `full_refresh` (`run --full-refresh`) menulis ulang observasi walau hash-nya sama, untuk memulihkan tabel yang diubah manual atau dipulihkan dari backup, dan menerima penarikan massal yang ditolak rem pengaman (setelah diperiksa manual). Penulisannya tetap idempoten.
- Sumber ber-key (BPS, FRED) nanti memakai permintaan tanpa pengalihan alamat, dan key ditambahkan saat permintaan dibuat, tidak pernah ditulis di `query` registri (yang ikut tersimpan di `etl.series.source_key`).

### 4.4 Auth

- **Tidak ada login pengguna.** Situs sepenuhnya publik dan hanya membaca.
- Identitas mesin:

| Siapa | Kredensial | Hak |
|---|---|---|
| Pipeline (GitHub Actions, laptop) | `SUPABASE_DB_URL` lewat session pooler | Penuh atas `etl` dan `public` |
| Server Vercel | Publishable key Supabase | Hanya SELECT pada `public.*` |
| Pipeline ke Vercel | `REVALIDATE_SECRET` | Memanggil revalidasi |
| cron-job.org ke Vercel | `HEALTH_TOKEN` | Membaca status kesehatan |
| cron-job.org ke GitHub | Token khusus repo ini, izin Actions: write | Menyalakan ulang workflow |
| Job `notify` | `GITHUB_TOKEN` dengan `issues: write` | Membuka issue kegagalan |

- **Wajib session pooler:** runner GitHub hanya mendukung IPv4, sedangkan host langsung database Supabase memakai IPv6.
- **Wajib TLS:** bila berkas `config/supabase-ca.crt` (sertifikat CA Supabase dari dashboard, publik) ada, koneksi pipeline memakai `sslmode=verify-full` sehingga identitas server ikut diverifikasi; tanpa berkas itu, `sslmode=require` (terenkripsi, tetapi tidak tahan penyadap yang memalsukan server). `sslmode` di string koneksi selalu menang, misalnya `disable` untuk Postgres lokal.
- Secret key Supabase tidak dipakai di MVP karena bisa menembus RLS. Setelah publishable key dipakai, legacy JWT key `anon` dan `service_role` dinonaktifkan di dashboard Supabase, karena keduanya tetap berlaku sampai dimatikan.
- Tanggal kedaluwarsa token cron-job.org dicatat di RUNBOOK; token yang kedaluwarsa membuat penyalaan ulang gagal tanpa terlihat.

### 4.5 Hosting

| Layanan | Paket | Batas yang relevan |
|---|---|---|
| Vercel | Hobby (gratis, non-komersial) | Fungsi maksimal 300 detik dan 2 GB; melewati batas berarti fitur terkunci sampai 30 hari |
| GitHub Actions | Gratis untuk repo publik | Job maksimal 6 jam; jadwal paling sering tiap 5 menit dan bisa tertunda; workflow terjadwal dimatikan setelah 60 hari tanpa aktivitas repo |
| Supabase | Free | Database 500 MB, egress 5 GB uncached + 5 GB cached per bulan, dijeda setelah satu minggu tanpa aktivitas, tanpa backup otomatis |
| cron-job.org | Gratis | Job dimatikan setelah lebih dari 25 kegagalan berturut-turut; notifikasi email kegagalan harus dinyalakan, dan status job dicek sebulan sekali |

- Syarat GitHub melarang Actions dipakai sebagai bagian aplikasi serverless, jadi Actions hanya menjalankan batch dan tidak pernah dipanggil per pengunjung.
- Runner cadangan bila GitHub Actions tidak bisa dipakai: laptop pengelola, lalu GitLab CI (400 menit per bulan).
- Proyek Supabase berada di region `ap-northeast-2` (Seoul), terlihat dari host Session pooler. Region fungsi Vercel didekatkan ke sana (`icn1`, Seoul).

### 4.6 Compute

- Runner `ubuntu-24.04` standar (gratis di repo publik). `pipeline.yml` memakai Python 3.14 lewat `setup-python`; fase 1 hanya butuh psycopg 3 dari lockfile berhash (`requirements.txt`), sedangkan pandas 3 dan statsmodels 0.15 masuk di fase 3. Uji akses (`smoke.yml`) tetap memakai `python3` bawaan runner (3.12) dan hanya pustaka standar. Seluruh kode dites kompatibel dengan Python 3.12.
- Job harian dibatasi 60 menit. Backtest berjalan di job `backtest` tersendiri (lihat 4.7), karena lamanya belum terukur.
- Model (fase 3):

| Target | Baseline | Model MVP | Horizon |
|---|---|---|---|
| PDB | AR pada pertumbuhan yoy kuartalan | Dynamic factor model campuran frekuensi (`DynamicFactorMQ`) | Kuartal berjalan sampai akhir tahun depan |
| Inflasi | AR, atau "sama dengan bulan lalu" | ARIMAX dengan harga komoditas, kurs, BI-Rate | 12-18 bulan |
| TPT | "Sama dengan rilis terakhir" | Regresi sederhana dengan forecast PDB | Dua rilis berikutnya |

- Ketiga target dihitung dalam satu proses supaya ceritanya konsisten. VAR atau BVAR gabungan menyusul setelah baseline stabil.
- Hukum Okun di Indonesia lemah menurut sejumlah studi, jadi model TPT sengaja sederhana dan diberi label eksperimental.
- Variabel hari libur (Ramadan/Lebaran berpindah bulan), dummy kebijakan sekali jalan, dan dummy COVID masuk sebagai fitur.
- Model hanya dijalankan ulang bila target atau fitur periode-lengkap berubah. Data harian (kurs) masuk sebagai rata-rata bulan yang sudah lengkap.
- Rentang ketidakpastian diambil dari galat backtest (persentil per horizon). Backtest bergulir 2012-2025 menghormati jeda rilis; metriknya MAE dan RMSE per horizon dibanding baseline dan proyeksi IMF.
- Horizon panjang di MVP memakai proyeksi IMF WEO, bukan model sendiri.

### 4.7 CI/CD

- **`pipeline.yml`** (satu-satunya workflow yang menulis data). Fase 1: hanya dijalankan manual dengan mode `run`, `full_refresh`, atau `migrate`; jadwal ditambahkan setelah Secret terisi dan run manual pertama lulus. Bila dipicu jadwal, mode bawaannya `run`.
  - Job `run`, batas 60 menit: tes, ambil data, cek awal (koneksi, ukuran database, katalog akses), simpan, turunan, model (fase 3), publikasi, revalidasi (fase 2), catat run. Yang sudah ada: semua kecuali model dan revalidasi.
  - Job `backtest` (fase 3): berjalan setelah rilis target atau secara manual, dengan batas waktu sendiri; menulis `etl.backtest`.
  - Job `notify`, terpisah dengan izin `issues: write` saja: membuka atau mengomentari satu issue `pipeline-failure` berisi nama sumber, kode HTTP, dan tautan run.
  - `concurrency: con-fore-pipeline` dengan `queue: max` dan tanpa `cancel-in-progress`. Tanpa `queue: max`, run tertunda (misalnya `migrate` manual) bisa digantikan run berikutnya.
- **`backup.yml`**: lihat 4.13. Memakai grup concurrency yang sama supaya ekspor tidak terjadi di tengah publikasi.
- **`smoke.yml`** (ada sejak fase 0): dijalankan manual; menjalankan `tests.test_smoke` lalu uji akses setiap sumber dari runner, dan menulis hasilnya ke ringkasan job. Tes lain butuh psycopg, jadi dijalankan di `pipeline.yml`. Hanya langkah uji akses yang menerima Secret key BPS dan FRED. Permintaan yang membawa key menolak pengalihan alamat, dan catatan hasil hanya memuat kode HTTP atau jenis error.
- **`ci.yml`** (mulai fase 3): tes parser dengan fixture, tes batas WIB/UTC, smoke test model, dan uji migrasi terhadap Postgres lokal (`tests/test_db.py` dengan `CONFORE_TEST_DB_URL`). Tanpa secret. Sampai saat itu, tes database dijalankan di laptop. Uji akses ke proyek Supabase sungguhan berjalan di `pipeline.yml` mode `migrate`.
- Keamanan workflow: izin bawaan `contents: read`; setiap action dipin ke commit SHA dan diperbarui Dependabot; input manual dibaca lewat `env`; tidak pernah memakai `pull_request_target`.
- **Deploy situs:** Vercel membangun dari branch `main`, dan Ignored Build Step hanya membangun bila ada perubahan di `web/`. Pembaruan data cukup lewat revalidasi.

### 4.8 Row-level security

- Skema `etl` tidak terbuka ke Data API.
- Setiap tabel `public`: `revoke all`, `grant select` ke `anon`, RLS menyala, dan satu kebijakan baca.
- Mulai 2026-10-30, tabel baru di Supabase tidak otomatis terbuka ke Data API, dan membuat ulang tabel (DROP, `to_sql(replace)`) menghapus GRANT serta RLS. Karena itu tabel `public` hanya dibuat lewat migrasi, dan publikasi memakai DELETE + INSERT.
- Setiap run memeriksa katalog sebelum menulis (RLS, hak `anon` dan `authenticated`, kebijakan baca, view, fungsi, sequence, tabel `etl`, default privileges, dan hak skema), dan setiap migrasi memeriksanya di dalam transaksinya sendiri. Setelah migrasi, tes dengan publishable key memastikan pembacaan berhasil, penulisan ditolak, dan skema `etl` tidak dibuka; di GitHub Actions tes ini wajib. RPC tidak dites lewat API karena `public` tidak punya fungsi.
- Pola SQL lengkapnya di [SCHEMA.md](SCHEMA.md#4-kebijakan-akses).

### 4.9 Rate limiting

**Ke sumber data (keluar)**

| Host | Batas yang dipakai |
|---|---|
| OECD | Maksimal 60 unduhan per jam (batas resmi); tanpa VPN |
| FRED | Maksimal 120 permintaan per menit |
| IMF | Hanya seri di `config/series.toml`, sekali sehari, tanpa unduhan massal |
| BPS | Batas tidak dipublikasi; ikuti header `Ratelimit-*` |
| GDELT, Comtrade (nanti) | 1 permintaan per 5 detik dan 1 per detik |

Semua permintaan diberi jeda 1 detik dari permintaan sebelumnya, hanya mengikuti pengalihan ke `https`, dan mendapat maksimal 3 percobaan untuk 429, 5xx, koneksi putus, atau jawaban terpotong (Content-Length belum terpenuhi, atau tidak diakhiri baris baru), dengan jeda 5 lalu 10 detik atau sesuai `Retry-After` (maksimal 60 detik). Setelah `updatedAfter` dipakai, jawaban "tidak ada perubahan" (OECD 404, BIS 404 kode 100, IMF kosong) dicatat sebagai normal, bukan kegagalan.

**Ke situs (masuk)**

- Halaman disajikan dari cache CDN, jadi jumlah pengunjung tidak menambah beban Supabase.
- `/api/revalidate` dan `/api/health` menolak permintaan tanpa header rahasia.
- `/api/health` tidak di-cache di CDN (`Cache-Control: private, no-store`); pembacaan `site_status` di dalam fungsinya boleh di-cache 60 detik.

### 4.10 Cache dan CDN

- Halaman ISR dengan `revalidate` 6 jam sebagai cadangan. Setelah publikasi, pipeline memanggil `/api/revalidate`, yang menjalankan `revalidatePath('/', 'layout')` untuk semua halaman, lalu memanaskan cache dengan GET ke `/`, `/prediksi`, dan setiap `/indikator/<id>`.
- Bila pembacaan Supabase gagal, halaman melempar error sehingga Vercel tetap menyajikan halaman terakhir yang baik. Klien Supabase tidak melempar error sendiri, jadi setiap query memakai `.throwOnError()`, dan hasil kosong dari tabel wajib (`series_meta`, `latest_values`, `site_status`) dianggap error. Jangan merender halaman kosong atau 404, karena itu ikut ter-cache.
- Output render tidak bergantung waktu (`new Date()` atau angka acak); "terakhir diperbarui" diambil dari `public.site_status`.
- Pembaruan data tidak lewat redeploy, karena setiap deployment mulai dengan cache kosong. Build ikut membaca Supabase, jadi Supabase yang dijeda harus dipulihkan dulu sebelum deploy.

### 4.11 Scaling

- **Pengunjung:** halaman cache di CDN Vercel; Supabase hanya dibaca saat revalidasi, sehingga egress tidak mengikuti jumlah pengunjung.
- **Data:** tabel `public.chart_series` menyimpan satu baris per grafik (menghindari batas 1.000 baris Data API dan menghemat egress). Peringatan muncul saat database mencapai 300 MB dari batas 500 MB.
- **Negara lain (setelah MVP):** registri seri sudah memuat kode negara, sehingga negara baru berarti baris konfigurasi baru, bukan kode baru.

### 4.12 Error tracking dan log

- `etl.runs` (satu baris per run: pemicu, status ok/sebagian/gagal, commit) dan `etl.fetch_log` (per seri per run: status HTTP, kode error, hash, jumlah baris, periode terakhir, berubah atau tidak; tanpa URL).
- `public.site_status` hanya berisi kode tetap, bukan teks bebas.
- Issue `pipeline-failure` dari job `notify` menjadi notifikasi utama ke pengelola; email cron-job.org menjadi notifikasi kedua.
- Pipeline tidak pernah mencetak atau menyimpan teks error bebas, karena pesan error bisa memuat URL ber-key, host, atau user database. `fetch_log` dan ringkasan job hanya memuat kode HTTP, kode tetap (misalnya "tanpa data"), atau nama jenis error plus SQLSTATE. Error tak terduga dicetak sebagai baris kode traceback tanpa pesannya, dan logger psycopg dimatikan. GitHub memang menyamarkan Secret di log, tetapi tidak di isi issue atau database, dan tidak bila nilainya berubah bentuk. Karena tidak ada teks bebas, `redact()` belum dibuat; ia dibuat bila nanti ada teks bebas yang harus masuk issue (job `notify`).
- Log runtime Vercel di paket Hobby hanya disimpan 1 jam, jadi riwayat operasional tidak bergantung padanya.
- Satu seri gagal ditandai "terlambat" (`is_stale`) dan run tetap lanjut dengan status `partial`. Run dianggap gagal (`failed`, kode keluar 1) bila database tidak terjangkau, publikasi error, tidak ada satu pun seri yang berhasil diambil, seri mana pun gagal tiga kali berturut-turut, atau (nanti) target gagal validasi pada hari rilisnya. Status dinilai atas semua seri, bukan hanya yang diambil run itu, jadi run `--source` yang sukses tetap `partial` bila sumber lain masih gagal. `public.site_status.last_success_at` hanya maju pada run yang tidak gagal, supaya pemeriksaan kesehatan 36 jam tetap berbunyi saat sumber terus gagal; run yang berhenti karena error menandai `last_run_status = failed`.

### 4.13 Recovery

- **Backup:** `backup.yml` setiap Senin mengekspor tabel yang tidak bisa dibangun ulang (vintage observasi, forecast, backtest, target) dalam satu snapshot transaksi, sebagai aset GitHub Release, bukan commit, supaya tidak memicu build Vercel. Supabase Free tidak punya backup otomatis.
- **Run yang terlewat:** setiap run membandingkan periode dan hash terbaru dengan database, jadi run berikutnya otomatis mengejar ketinggalan.
- **Workflow dimatikan:** cron-job.org memanggil endpoint `enable` GitHub setiap hari (panggilan ini idempoten); bisa juga dari tab Actions. Apakah panggilan ini juga mereset hitungan 60 hari belum terbukti, sehingga pemeriksaan kesehatan harian tetap menjadi penjaga utama. Pipeline tidak membuat commit, jadi repo memang bisa 60 hari tanpa aktivitas.
- **Supabase dijeda:** pulihkan dari dashboard, lalu jalankan pipeline manual.
- **Kredensial bocor:** rotasi password database, key BPS, token, dan rahasia revalidasi; langkahnya di `RUNBOOK.md` (dibuat di fase 0).
- **Laptop sebagai cadangan:** perintah `python -m confore ...` yang sama bisa dijalankan dari laptop bila runner GitHub diblokir sebuah sumber.

## 5. Risiko utama

| Risiko | Tanda awal | Mitigasi |
|---|---|---|
| Mati diam-diam: jadwal terlewat atau workflow dimatikan, lalu Supabase dijeda | Run sukses terakhir lebih dari 36 jam | Pemeriksaan kesehatan dan penyalaan ulang harian dari cron-job.org; banner di situs |
| Akses sumber berubah atau diblokir | 403, 429, CSV kosong, periode tidak bergerak (404 dari OECD/BIS bisa berarti tidak ada perubahan) | Satu modul per sumber, uji kontrak, cadangan BPS/IMF, jalur laptop |
| Revisi dan ganti tahun dasar BPS | Riwayat berbeda dengan unduhan baru | Tabel vintage, kolom tahun dasar, seri baru saat rebasing |
| Key bocor di repo publik | Peringatan secret scanning | Error hanya berupa kode, key tidak pernah di registri, izin minimal, push protection |
| Model meleset (Lebaran berpindah bulan, kebijakan sekali jalan, patahan COVID) | Kalah dari baseline berturut-turut | Variabel hari libur dan dummy; baseline selalu tampil; meleset tetap dipublikasikan |
| Kebijakan paket gratis berubah | Changelog harga, email penyedia | Python dan SQL standar, backup mingguan, runner cadangan |
| Dependensi berubah (pandas 3, statsmodels, Node di runner) | FutureWarning, backtest bergeser tanpa data baru | Lockfile berhash, versi paket dicatat di setiap forecast |
| Salah tanggal: UTC vs WIB, periode vs tanggal rilis | Bulan salah tampil, duplikat tengah malam | `timestamptz` UTC, tampilan Asia/Jakarta, tes batas waktu |

Risiko produk ada di [PRD.md](PRD.md#7-risiko-produk).

## 6. Rujukan

**Platform**

- Batas GitHub Actions: https://docs.github.com/en/actions/reference/limits
- Jadwal GitHub Actions: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Concurrency GitHub Actions: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- Menyalakan ulang workflow: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows
- Keamanan GitHub Actions: https://docs.github.com/en/actions/reference/security/secure-use
- Harga Supabase: https://supabase.com/pricing
- Perubahan akses Data API Supabase: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Kunci API Supabase: https://supabase.com/docs/guides/api/api-keys
- Batas Vercel Functions: https://vercel.com/docs/functions/limitations
- ISR Vercel: https://vercel.com/docs/incremental-static-regeneration
- Cache CDN Vercel: https://vercel.com/docs/caching/cdn-cache
- `revalidatePath` Next.js: https://nextjs.org/docs/app/api-reference/functions/revalidatePath
- cron-job.org: https://cron-job.org/en/faq/

**Sumber data**

- IMF Data (WEO, QNEA, CPI, PCPS): https://data.imf.org
- BPS WebAPI: https://webapi.bps.go.id
- BIS Data Portal: https://data.bis.org
- OECD Data Explorer: https://data-explorer.oecd.org
- Frankfurter: https://frankfurter.dev
- FRED API: https://fred.stlouisfed.org/docs/api/fred/

**Metodologi**

- Luciani dkk., Nowcasting Indonesia: https://www.federalreserve.gov/econres/feds/nowcasting-indonesia.htm
- IMF WP/25/252, ekonometrika vs ML untuk nowcasting PDB: https://www.imf.org/en/publications/wp/issues/2025/12/05/gdp-nowcasting-performance-of-traditional-econometric-models-vs-machine-learning-572360
