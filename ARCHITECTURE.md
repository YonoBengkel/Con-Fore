Status: pipeline data dan situs tab Data sesuai kode di `main` (2026-10-31), dan pipeline jalan dengan jadwal harian. Deploy situs, panggilan revalidasi dari pipeline, model, backup, dan pemantauan masih rencana yang disetujui pengelola 2026-10-30.

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
  DESIGN.md              panduan desain, disetujui pengelola 2026-10-31   [ada]
  .gitignore  .env.example                                    [ada]
  requirements.in        dependensi langsung (psycopg)        [ada]
  requirements.txt       lockfile berhash dari `uv pip compile` [ada]
  confore/               paket Python
    smoke.py             uji akses setiap sumber, satu permintaan kecil per sumber   [ada]
    config.py            muat dan periksa config/ (seri, sumber, target, kalender, format query BPS)   [ada]
    fetch.py             pengambil CSV SDMX (IMF, BIS, OECD, ECB) dan JSON WebAPI BPS: retry, batas kuota, normalisasi periode, hash   [ada]
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
  web/                   situs Next.js (App Router), cara menjalankannya di web/README.md   [ada]
    app/                 halaman dan route API (csv, health, revalidate)   [ada]
    components/          segitiga (SVG), grafik, kartu, komponen browser   [ada]
    lib/                 pembacaan Data API, aturan skor, isi tetap (SERI_KARTU), format   [ada]
    scripts/             salin-env.mjs: salin dua baris Supabase dari ../.env ke web/.env.local   [ada]
    vercel.json          region icn1 dan Ignored Build Step   [ada]
    .env.example         daftar variabel environment situs   [ada]
  tests/                 test_smoke.py, test_pipeline.py, test_bps.py, test_db.py (Postgres lokal)   [ada]
  .github/
    dependabot.yml       pembaruan bulanan untuk action yang dipin   [ada]
    workflows/           smoke.yml, pipeline.yml [ada]; nanti backup.yml, ci.yml
  docs/                  catatan metodologi (tanpa data asli)
```

Rencana awal memakai satu modul per sumber di `confore/sources/`. Karena keempat sumber tanpa key menjawab dalam CSV SDMX yang sama, cukup satu pengambil generik. BPS menjawab dalam JSON, jadi punya parser sendiri di `fetch.py` (`parse_bps`) dan format query yang ketat (lihat 4.3); FRED nanti mengikuti cara yang sama. Registri memakai TOML (bukan YAML) karena `tomllib` ada di pustaka standar.

## 3. Cara menjalankan

Lokal, dengan `.env` berisi variabel di bawah (`.env` masuk `.gitignore` sejak commit pertama) dan dependensi dari `requirements.txt` (lihat README):

```
python -m confore migrate          # terapkan migrasi SQL yang belum jalan, lalu cek katalog dan uji Data API
python -m confore run --dry-run    # ambil semua seri dan hitung turunan tanpa database
python -m confore run              # ambil, cek akses, simpan vintage baru, publikasi public.*
python -m confore run --source imf # hanya ambil satu sumber; publikasi tetap untuk semua seri
python -m confore run --source bps --trigger release   # yang dijalankan jadwal hari rilis BPS
```

Seri BPS butuh `BPS_API_KEY`; tanpa key, ketiga seri BPS gagal dengan kode "BPS_API_KEY belum diisi" dan seri lain tetap jalan.

Situs lokal (Node 24), dari folder `web/` (detailnya di `web/README.md`):

```
npm ci                 # pasang dependensi persis dari package-lock.json
npm run salin-env      # salin SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY dari ../.env ke web/.env.local
npm test               # tes aturan skor segitiga
npm run dev            # situs lokal di http://localhost:3000, membaca Supabase
npm run build          # build produksi; ikut membaca Supabase, jadi Supabase harus aktif
npm start              # sajikan hasil build
```

Urutan satu `run`: muat dan periksa `config/`, ambil setiap seri dengan jeda 1 detik (sebelum koneksi database dibuka, supaya koneksi tidak menganggur saat sumber lambat), buka koneksi, ambil kunci advisory (run atau migrasi lain yang sedang berjalan membuat run ini berhenti), cek katalog akses (berhenti bila ada akses yang tidak aman) dan ukuran database, catat baris `etl.runs`, salin `config/` ke `etl`, tulis vintage baru dan `fetch_log` per seri, tentukan status, publikasi, lalu tutup baris run. Pemanggilan `/api/revalidate` dari pipeline belum dibuat (lihat 4.10).

| Variabel | Dipakai oleh | Isi |
|---|---|---|
| `SUPABASE_DB_URL` | Pipeline | String koneksi **session pooler** (berisi password database) |
| `BPS_API_KEY`, `FRED_API_KEY` | Pipeline dan uji akses | Key gratis; BPS sudah dipakai, FRED nanti |
| `REVALIDATE_SECRET` | Vercel; pipeline nanti | Rahasia bersama untuk `/api/revalidate` |
| `HEALTH_TOKEN` | Vercel dan cron-job.org | Token header untuk `/api/health` |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Vercel (hanya server); pipeline untuk uji akses setelah migrasi | Alamat proyek dan kunci publik |
| `SITE_URL` | Pipeline (nanti, untuk revalidasi) | Domain produksi situs |

Di GitHub, nilai ini disimpan sebagai Secrets (`pipeline.yml` hanya membaca Secrets). Di Vercel, sebagai Environment Variables tanpa awalan `NEXT_PUBLIC_`, supaya hanya server yang bisa membacanya. Untuk situs lokal, `web/.env.local` (daftarnya di `web/.env.example`). String session pooler disalin dari tombol Connect di dashboard Supabase (pilihan "Session pooler") langsung ke tempat-tempat itu, tidak pernah lewat chat atau commit.

## 4. Lapisan aplikasi

### 4.1 Front end

- Next.js 16 App Router di runtime Node 24, untuk Vercel (kode di `web/`, belum tayang).
- Halaman: `/` (tab Data), `/indikator/[id]` (detail per seri), `/cara-kerja`, `/sumber`, dan `/prediksi` (penanda "segera" sampai v0.2).
- Data dibaca di server lalu dirender sebagai halaman statis yang di-cache (ISR, 6 jam). Browser hanya menerima HTML dan data grafik.
- `/indikator/[id]` dan `/api/csv/[chart_id]` dibangun saat build untuk seri di `public.series_meta` ditambah `SERI_DITAUTKAN` (seri kartu dan panel penggerak), dengan `dynamicParams = false`: id lain langsung 404 tanpa render. Seri baru di luar daftar itu baru mendapat halaman setelah build web berikutnya.
- Segitiga dua lensa digambar sebagai SVG dari seri IMF WEO tahunan (`SERI_SEGITIGA` di `web/lib/skor.ts`). Kedua panel lensa sudah dirender di server; skrip kecil di `<head>` memilih panel dari `?lensa=` sebelum halaman tampil, dan tombol lensa berpindah tanpa memuat ulang. Lensa tidak dibaca di server, karena itu membuat `/` dinamis dan mematikan ISR. Tanpa JavaScript, hanya lensa bawaan yang tampil.
- Tiga kartu memakai seri pertama yang tersedia dari `SERI_KARTU` di `web/lib/konten.ts`: seri BPS didahulukan, salinan IMF menjadi cadangan, dan kartu tanpa seri menampilkan "Data belum tersedia". Tanggal rilis berikutnya di kartu menyebut kalender siapa, misalnya jadwal BPS untuk angka yang menyusul lewat salinan IMF.
- Unduh CSV dibuat di server dari `public.chart_series` lewat route `/api/csv/[chart_id]` yang di-cache bersama halaman.
- Banner "data mungkin belum diperbarui" dihitung di browser dari `last_success_at` (lebih dari 36 jam), supaya tetap muncul walau Supabase sedang mati.
- Halaman `/sumber` menampilkan kalimat atribusi wajib per sumber dari `public.sources`.
- Bahasa Indonesia, mengutamakan HP, tema terang dan gelap. Kalimat ringkasan menjadi teks alternatif segitiga. Arah tampilannya diusulkan di [DESIGN.md](DESIGN.md) (belum disetujui).

### 4.2 API

- **Tidak ada API buatan sendiri untuk data.** Server Vercel membaca Data API (PostgREST) bawaan Supabase dengan publishable key, memakai `fetch` biasa tanpa pustaka klien Supabase (`web/lib/data.ts`).
- Route milik situs (`/api/revalidate` dan `/api/health` selalu menjawab dengan `Cache-Control: private, no-store`):
  - `POST /api/revalidate`: untuk pipeline setelah publikasi (pemanggilnya belum dibuat). Wajib header `x-revalidate-secret`; 401 bila rahasianya salah, 503 bila `REVALIDATE_SECRET` belum diisi, 405 untuk GET. Menjalankan `revalidateTag('supabase', 'max')` (lihat 4.10).
  - `GET /api/health`: dipanggil cron-job.org. Wajib header `x-health-token`; 401 tanpa token yang benar. Jawaban JSON (`status`, `last_success_at`, `last_run_status`, `umur_jam`, `stale_sources`): 200 bila run sukses terakhir paling lama 36 jam lalu, 503 bila lebih (`basi`), Supabase tidak terbaca (`supabase_gagal`), atau `HEALTH_TOKEN` belum diisi.
  - `GET /api/csv/[chart_id]`: unduhan CSV untuk pengunjung. Baris awal berawalan `#` memuat sitasi, kalimat atribusi, dan syarat penggunaan setiap sumber.
- Header rahasia dibandingkan dengan waktu tetap (`web/lib/rahasia.ts`), supaya isinya tidak bocor lewat lama jawaban.
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
| BPS WebAPI | Inflasi y-on-y (var 2263), pertumbuhan PDB y-on-y (var 104), TPT per ronde Sakernas (var 543 dan 2562); nanti ekspor-impor dan daftar rilis pers | `webapi.bps.go.id`, key gratis di path URL | CPI: hari kerja pertama, sekitar 11.00 WIB. PDB dan TPT: tanggal 5 Feb, Mei, Agu, Nov (ronde triwulanan Sakernas ada sejak 2025) | Rilis pers baru bertanggal hari ini, atau periode baru di variabelnya. PDB: tarik ulang seluruh riwayat karena kuartal lama ikut direvisi. TPT: bandingkan hanya ronde bulan yang sama | Wajib kalimat "Layanan ini menggunakan API Badan Pusat Statistik (BPS)."; situs tidak boleh terkesan resmi BPS; penggunaan komersial butuh persetujuan BPS; data simpanan tidak boleh disajikan sebagai terbaru bila BPS sudah memperbaruinya; batas 60 permintaan per menit, 1.000 per jam, 10.000 per hari (header `RateLimit-Policy`) | MVP (branch `v0.1-tab-data`); syarat rilis v0.1 |
| `config/*` | Target resmi, sumber, kalender rilis, hari libur | Diisi manual di repo | Saat ada perubahan | Push ke `config/**` | - | MVP |
| FRED, BI SEKI, halaman BI-Rate, GDELT, Comtrade | Pelengkap | Key, HTML, atau batas ketat | - | - | - | Nanti |

Tidak dipakai: IMF DataMapper (menjawab 403) dan CSV grafik FRED (koneksi ditolak). Pipeline hanya menarik seri yang disebut di `config/series.toml`.

**Yang sudah jalan:** sejak fase 1 (di `main`), IMF (WEO, QNEA, CPI, PCPS), BIS, OECD, dan ECB, 14 seri ditambah 2 turunan. Sejak v0.1, BPS menambah 3 seri rilis pertama, jadi totalnya 17 seri ditambah 2 turunan. Setiap run mengambil seri penuh (sejak 2000 untuk sumber SDMX; jawaban kecil berkat `detail=dataonly`, kecuali WEO yang butuh kolom `LATEST_ACTUAL_ANNUAL_DATA`), lalu membandingkan hash data ternormalisasi dengan pengambilan terakhir. Kolom "Cara mendeteksi data baru" di atas (`updatedAfter`, 404 sebagai "tidak ada perubahan", rilis pers BPS) adalah optimasi yang belum dipakai. Frankfurter dan World Bank baru dipakai di uji akses.

**Cara pengambil BPS bekerja** (`fetch.py`, bagian BPS; semua aturan WebAPI di bawah sudah dicek ke jawaban sungguhan 2026-10-30):

- Seri BPS: `bps_cpi_yoy_m` (var 2263, inflasi y-on-y tahun dasar 2022=100, baris INDONESIA, sejak 2024), `bps_gdp_growth_q` (var 104, laju pertumbuhan PDB seri 2010, baris PDB, y-on-y, sejak 2011), dan `bps_unemp_round` (TPT per ronde Sakernas: var 543 untuk ronde Februari dan Agustus sejak 2011, digabung dengan var 2562 untuk ronde triwulanan sejak 2025). Riwayat inflasi tahun dasar 2018=100 tidak ditambahkan, mengikuti aturan "tahun dasar baru berarti seri baru".
- Query di registri: `domain/<kode>/var/<id>/sejak/<tahun>` plus filter opsional `?vervar=..&turvar=..`, angka saja. Beberapa variabel digabung dengan ` + `; untuk periode yang sama, variabel yang ditulis belakangan menang. `config.py` menolak query BPS yang tidak cocok dengan pola ini, jadi key tidak mungkin tertulis di registri.
- Saat permintaan dibuat, kode menyusun `.../domain/<kode>/var/<id>/th/<th>/key/<key>/`. Id tahun `th` adalah tahun dikurangi 1900 (126 = 2026). WebAPI hanya menerima paling banyak 3 tahun per permintaan, jadi riwayat diminta per potongan 3 tahun, mulai dari yang terbaru.
- Membaca nilai: kunci `datacontent` adalah gabungan id vervar, var, turvar, tahun, dan turunan tahun tanpa pemisah. Parser tidak memecah kunci, tetapi menyusun setiap kunci dari daftar label lalu mencocokkannya. Januari sampai Desember menjadi `YYYY-MM` (ronde Sakernas memakai bulan survei), Triwulan I sampai IV menjadi `YYYY-Qn`, dan "Tahunan" dilewati.
- Tahun yang belum punya data dijawab OK dengan `datacontent` kosong. Variabel atau baris yang tidak dikenal juga dijawab begitu, tetapi dimensinya kosong; karena itu dimensi diperiksa lebih dulu (kode error di 4.12).
- 14 permintaan per run di 2026 (inflasi 1, PDB 6, TPT 6 + 1), sekitar 24 detik.
- Tanggal rilis per observasi tidak dicatat, karena WebAPI hanya memberi tanggal pembaruan per variabel.
- Atribusi dan syarat ada di baris `bps` di `config/sources.csv` (ketentuan WebAPI di https://webapi.bps.go.id/developer/). Halaman `/sumber` dan setiap CSV menampilkannya.

**Jadwal penarikan**

Cron di GitHub Actions ditulis dalam **UTC** (bawaan; kunci `timezone` juga tersedia, tetapi tidak dipakai supaya konversinya selalu tertulis). WIB = UTC + 7, tanpa musim panas. Semua logika tanggal di kode memakai zona `Asia/Jakarta`.

| Run | Cron (UTC) | Waktu WIB | Isi |
|---|---|---|---|
| Harian | `17 23 * * *` | 06.17, **tanggal WIB = tanggal UTC + 1** | Cek perubahan semua sumber; ambil yang berubah; model bila input berubah; publikasi |
| Hari rilis BPS | `17 8,11 1-8 * *` | 15.17 dan 18.17, tanggal 1-8 (tanggal UTC = tanggal WIB) | `run --source bps --trigger release`: ambil hanya seri BPS, beberapa jam setelah rilis sekitar 11.00 WIB, lalu publikasi semua seri. Sudah ditulis di `pipeline.yml` branch `v0.1-tab-data`; GitHub hanya menjalankan jadwal dari branch utama, jadi aktif setelah merge ke `main` |
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
- Sumber ber-key memakai permintaan tanpa pengalihan alamat (`KEYED_OPENER`; sudah dipakai BPS, nanti FRED), supaya key tidak terkirim ke alamat lain. Key ditambahkan saat permintaan dibuat dan tidak pernah ditulis di `query` registri (yang ikut tersimpan di `etl.series.source_key`), di `fetch_log`, atau di kode error.

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
- Proyek Supabase berada di region `ap-northeast-2` (Seoul), terlihat dari host Session pooler. Region fungsi Vercel didekatkan ke sana (`icn1`, Seoul), ditulis di `web/vercel.json`.

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

- **`pipeline.yml`** (satu-satunya workflow yang menulis data). Pemicu: jadwal harian `17 23 * * *` (06.17 WIB), jadwal hari rilis BPS `17 8,11 1-8 * *` (15.17 dan 18.17 WIB tanggal 1-8), push ke `main` yang mengubah `config/**`, dan manual dengan mode `run`, `full_refresh`, atau `migrate`. Jadwal harian dan push memakai mode `run`. Jadwal hari rilis BPS dikenali dari `github.event.schedule` dan selalu menjalankan `python -m confore run --source bps --trigger release`. Jadwal hari rilis BPS dan Secret BPS di langkah `Pipeline` baru ada di branch `v0.1-tab-data`.
  - Secret per langkah: langkah `Tes` tidak menerima Secret apa pun; langkah `Pipeline` menerima `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, dan `BPS_API_KEY`.
  - Job `run`, batas 60 menit: tes, ambil data, cek awal (koneksi, ukuran database, katalog akses), simpan, turunan, model (fase 3), publikasi, revalidasi (fase 2), catat run. Yang sudah ada: semua kecuali model dan revalidasi.
  - Job `backtest` (fase 3): berjalan setelah rilis target atau secara manual, dengan batas waktu sendiri; menulis `etl.backtest`.
  - Job `notify`, terpisah dengan izin `issues: write` saja: membuka atau mengomentari satu issue `pipeline-failure` berisi nama sumber, kode HTTP, dan tautan run.
  - `concurrency: con-fore-pipeline` dengan `queue: max` dan tanpa `cancel-in-progress`. Tanpa `queue: max`, run tertunda (misalnya `migrate` manual) bisa digantikan run berikutnya.
- **`backup.yml`**: lihat 4.13. Memakai grup concurrency yang sama supaya ekspor tidak terjadi di tengah publikasi.
- **`smoke.yml`** (ada sejak fase 0): dijalankan manual; menjalankan `tests.test_smoke` lalu uji akses setiap sumber dari runner, dan menulis hasilnya ke ringkasan job. Tes lain butuh psycopg, jadi dijalankan di `pipeline.yml`. Di workflow ini, hanya langkah uji akses yang menerima Secret key BPS dan FRED. Permintaan yang membawa key menolak pengalihan alamat, dan catatan hasil hanya memuat kode HTTP atau jenis error.
- **`ci.yml`** (mulai fase 3): tes parser dengan fixture, tes batas WIB/UTC, smoke test model, dan uji migrasi terhadap Postgres lokal (`tests/test_db.py` dengan `CONFORE_TEST_DB_URL`). Tanpa secret. Sampai saat itu, tes database dijalankan di laptop. Uji akses ke proyek Supabase sungguhan berjalan di `pipeline.yml` mode `migrate`.
- Keamanan workflow: izin bawaan `contents: read`; setiap action dipin ke commit SHA dan diperbarui Dependabot; input manual dibaca lewat `env`; tidak pernah memakai `pull_request_target`.
- **Deploy situs** (rencana; belum dideploy, langkahnya di RUNBOOK): Vercel membangun dari branch `main` dengan Root Directory `web`. Ignored Build Step ada di `web/vercel.json` (`ignoreCommand`): build hanya bila `web/` berubah sejak commit yang terakhir dideploy (`VERCEL_GIT_PREVIOUS_SHA`, atau `HEAD^` bila variabel itu kosong). Pembaruan data cukup lewat revalidasi.

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
| BPS | Batas WebAPI 60 permintaan per menit, 1.000 per jam, 10.000 per hari (header `RateLimit-Policy`). Pipeline memakai 14 permintaan per run dengan jeda 1 detik di antaranya |
| GDELT, Comtrade (nanti) | 1 permintaan per 5 detik dan 1 per detik |

Semua permintaan diberi jeda 1 detik dari permintaan sebelumnya, hanya mengikuti pengalihan ke `https` (permintaan ber-key tidak mengikuti pengalihan sama sekali), dan mendapat maksimal 3 percobaan untuk 429, 5xx, koneksi putus, atau jawaban terpotong (Content-Length belum terpenuhi, atau tidak berakhir seperti jawaban utuh: baris baru untuk CSV, `}` untuk JSON BPS), dengan jeda 5 lalu 10 detik atau sesuai `Retry-After` (maksimal 60 detik). Setelah jawaban sukses, bila header `RateLimit-Remaining` bernilai 5 atau kurang, pipeline menunggu dulu sebanyak `RateLimit-Reset` detik (maksimal 60), atau 60 detik bila header itu tidak ada. BPS mengirim `RateLimit-Limit`, `RateLimit-Remaining`, dan `RateLimit-Policy`, tetapi tidak `RateLimit-Reset`. Aturan ini berlaku untuk semua sumber yang mengirim header tersebut, bukan hanya BPS. Setelah `updatedAfter` dipakai, jawaban "tidak ada perubahan" (OECD 404, BIS 404 kode 100, IMF kosong) dicatat sebagai normal, bukan kegagalan.

**Ke situs (masuk)**

- Halaman disajikan dari cache CDN, jadi jumlah pengunjung tidak menambah beban Supabase.
- `/api/revalidate` dan `/api/health` menolak permintaan tanpa header rahasia.
- Alamat `/indikator/<id>` dan `/api/csv/<id>` dengan id karangan langsung 404 tanpa render dan tanpa menulis cache (`dynamicParams = false`), jadi tidak bisa dipakai untuk menghabiskan kuota ISR paket Hobby.
- `/api/health` tidak di-cache di CDN (`Cache-Control: private, no-store`); pembacaan `site_status` di dalam fungsinya boleh di-cache 60 detik.

### 4.10 Cache dan CDN

- Halaman dan CSV memakai ISR dengan `revalidate` 6 jam sebagai cadangan. Selama pipeline belum memanggil revalidasi, angka baru baru tampil setelah cache 6 jam itu habis.
- Setiap pembacaan Supabase diberi tag `supabase`. `POST /api/revalidate` menjalankan `revalidateTag('supabase', 'max')`: semua halaman dan CSV yang membaca Supabase ditandai basi, tetapi tidak langsung dibuang. Permintaan pertama sesudahnya masih mendapat halaman lama dan memicu render baru di latar; bila render itu gagal, halaman lama dipertahankan. `revalidatePath` sengaja tidak dipakai, karena langsung membuang cache, sehingga Supabase yang gagal tepat sesudahnya membuat pengunjung mendapat error 500. Perilaku ini diuji dengan `next start`, belum di Vercel.
- Rencana pipeline (belum dibuat): setelah publikasi, panggil `POST /api/revalidate`, lalu cukup satu GET per halaman yang membaca Supabase (`/`, `/sumber`, setiap `/indikator/<id>`) untuk memicu render baru. Pemanasan itu harus menerima 404 untuk seri baru yang belum punya halaman sampai build web berikutnya.
- Bila pembacaan Supabase gagal, halaman melempar error sehingga Vercel tetap menyajikan halaman terakhir yang baik. Situs memakai `fetch` biasa ke PostgREST (`web/lib/data.ts`), yang melempar error untuk jawaban selain 2xx. Hasil kosong dari tabel wajib juga dianggap error: `series_meta`, `latest_values`, `site_status`, `sources` (tanpanya atribusi hilang dari `/sumber` dan CSV), dan `chart_series` untuk beranda serta daftar id saat build. `targets` dan `release_calendar` boleh kosong. Jangan merender halaman kosong atau 404 untuk data yang gagal dibaca, karena itu ikut ter-cache.
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
- Kode tetap khusus pengambil BPS: "BPS_API_KEY belum diisi" dan "format BPS_API_KEY tidak valid" (key tidak pernah ikut di pesan); "bukan JSON", "status bukan OK", "kolom berubah", "kode tidak dikenal", "kode ganda", "periode ganda", "periode tidak valid", dan "nilai tidak valid" (bentuk jawaban berubah); "dimensi berubah" (variabel atau baris vervar dan turvar hilang, bertambah, atau diberi nomor baru); dan "tanpa data" bila satu variabel dalam seri gabungan ` + ` tidak menghasilkan data sama sekali. Dengan dua kode terakhir, variabel yang hilang menggagalkan seluruh seri, bukan diam-diam menghapus rondenya dari seri gabungan. Galat HTTP dicatat sebagai `HTTP <kode>` tanpa URL, karena URL BPS memuat key.
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
- `revalidateTag` Next.js: https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- cron-job.org: https://cron-job.org/en/faq/

**Sumber data**

- IMF Data (WEO, QNEA, CPI, PCPS): https://data.imf.org
- BPS WebAPI: https://webapi.bps.go.id (ketentuan penggunaan: https://webapi.bps.go.id/developer/)
- BIS Data Portal: https://data.bis.org
- OECD Data Explorer: https://data-explorer.oecd.org
- Frankfurter: https://frankfurter.dev
- FRED API: https://fred.stlouisfed.org/docs/api/fred/

**Metodologi**

- Luciani dkk., Nowcasting Indonesia: https://www.federalreserve.gov/econres/feds/nowcasting-indonesia.htm
- IMF WP/25/252, ekonometrika vs ML untuk nowcasting PDB: https://www.imf.org/en/publications/wp/issues/2025/12/05/gdp-nowcasting-performance-of-traditional-econometric-models-vs-machine-learning-572360
