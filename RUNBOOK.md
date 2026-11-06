Status: langkah fase 0, fase 1, dan penayangan situs (bagian 5) sudah dijalankan. Pemeriksaan kesehatan cron-job.org belum dipasang. Langkah untuk komponen yang belum ada dicek ulang saat komponennya jadi.

# Runbook Con-Fore

Langkah operasional dan pemulihan. Arsitekturnya ada di [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Sebelum setiap commit

1. Pastikan `.env` tidak ikut: `git check-ignore -v .env` harus menunjuk ke `.gitignore`, dan `git status` tidak menampilkan `.env` atau `.venv/`.
2. Stage berkas satu per satu, jangan `git add .`.
3. Secret scanning dan push protection repo sudah menyala sejak 2026-10-30 (Settings repo > Security and quality > Advanced Security). Secret scanning GitHub tidak mengenali key BPS dan FRED, jadi langkah 1 tetap wajib.

## 2. Menyimpan kredensial

- Salin string **Session pooler** dari tombol Connect di dashboard Supabase langsung ke GitHub Secrets (`SUPABASE_DB_URL`) dan `.env` laptop. Jangan lewat chat, issue, atau commit.
- GitHub: **Settings > Secrets and variables > Actions > Secrets**. `pipeline.yml` membaca `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `BPS_API_KEY`, `REVALIDATE_SECRET`, dan `SITE_URL` sebagai Secrets. `SUPABASE_URL` tidak rahasia, tetapi memuat ref proyek yang sengaja tidak ditampilkan di log publik.
- Nilai disimpan tanpa spasi atau tanda kutip di sekitarnya; uji akses menolak key yang formatnya tidak valid.
- Satu Secret per variabel: nama persis seperti di `.env` (misalnya `SUPABASE_DB_URL`), isinya hanya nilainya (tanpa `NAMA=`).
- Bila run di GitHub menyebut "... belum diisi" padahal `.env` di laptop terisi, Secret tersimpan di tempat yang tidak dibaca workflow: tab **Variables** (bukan Secrets), menu **Codespaces** atau **Dependabot** (bukan Actions), pengaturan **akun** (bukan pengaturan repo), atau satu Secret berisi seluruh isi `.env`. Yang benar: halaman repo > Settings > Secrets and variables > Actions > tab Secrets > bagian **Repository secrets**.
- Mulai fase 2: rahasia acak untuk `REVALIDATE_SECRET` dan `HEALTH_TOKEN` dibuat sendiri oleh pengelola, langsung ke clipboard, tidak pernah dijalankan lewat sesi agent:

```
python -c "import secrets; print(secrets.token_urlsafe(32), end='')" | clip
```

## 3. Uji akses sumber

- Laptop: `python -m confore.smoke` dari folder repo.
- Runner GitHub: tab **Actions > Uji akses sumber > Run workflow**. Hasilnya muncul di ringkasan job.
- Fase 0 baru selesai bila baris **BPS** di ringkasan job berhasil (`ok`). `dilewati` berarti Secret `BPS_API_KEY` belum diterima runner.
- Bila sebuah sumber gagal dari runner tetapi jalan dari laptop, sumber itu memblokir IP pusat data. Catat di ARCHITECTURE.md dan ambil sumber itu dari laptop.
- Jalankan ulang setiap kali menambah sumber atau mengganti key.

## 4. Menyalakan pipeline pertama kali (fase 1)

1. Isi `.env` laptop dengan `SUPABASE_DB_URL`, `SUPABASE_URL`, dan `SUPABASE_PUBLISHABLE_KEY` (bagian 2). Disarankan: unduh sertifikat CA dari dashboard Supabase (pengaturan Database, bagian SSL) dan simpan sebagai `config/supabase-ca.crt` supaya koneksi memverifikasi identitas server; berkas ini publik dan boleh di-commit. Bila koneksi lalu gagal karena sertifikat, hapus berkas itu dan catat di ARCHITECTURE.md.
2. Dari folder repo dengan Python `.venv`: `python -m confore migrate`. Hasil yang benar: tiga migrasi diterapkan dan "Uji Data API lulus". Bila muncul "akses tidak aman" (migrasi dibatalkan) atau "akses public tidak aman", berhenti dan periksa nama objek yang disebut; migrasi sebelum yang dibatalkan tetap tersimpan.
3. `python -m confore run --dry-run`, lalu `python -m confore run`. Run kedua di hari yang sama harus menulis 0 baris vintage baru.
4. Isi tiga Secret di GitHub (ketiganya wajib: tanpa dua yang terakhir, mode `migrate` di Actions berhenti), lalu **Actions > Pipeline data > Run workflow** dengan mode `migrate` (harus "tidak ada yang baru" dan "Uji Data API lulus"), lalu mode `run`.
5. Setelah run manual dari runner lulus, tambahkan jadwal harian ke `pipeline.yml` (lihat ARCHITECTURE.md, Jadwal penarikan). Sudah dilakukan 2026-10-30; run terjadwal pertama 2026-10-31 06.17 WIB.
6. Pengaturan sekali jalan: di dashboard Supabase, matikan pendaftaran pengguna baru (Authentication > Sign In / Providers), karena situs tanpa login; di repo GitHub, nyalakan **Dependabot alerts** (Settings > Security and quality > Advanced Security) supaya rilis keamanan psycopg di `requirements.txt` terlihat.
Bila koneksi gagal: periksa bahwa `SUPABASE_DB_URL` adalah string **Session pooler** (user `postgres.<ref>`, host berakhiran `.pooler.supabase.com`, port 5432). String koneksi langsung (host `db.<ref>.supabase.co`, user `postgres`) hanya bisa dijangkau lewat IPv6, jadi gagal dari runner GitHub dan dari jaringan tanpa IPv6.

7. Bila sebuah run perlu menulis ulang semua observasi (tabel diubah manual atau dipulihkan dari backup), jalankan workflow dengan mode `full_refresh`, atau `python -m confore run --full-refresh`.
8. Bila ringkasan run menunjukkan "terlalu banyak periode hilang", sumber memotong riwayat seri itu. Cek dulu di portal sumbernya. Bila memang disengaja sumber, jalankan mode `full_refresh` untuk menerimanya; bila tidak, biarkan (run berikutnya mencoba lagi, dan setelah tiga kali gagal run ditandai `failed`).
9. Pesan "run atau migrasi lain sedang berjalan" berarti ada run lain (laptop atau GitHub) yang memegang kunci database. Tunggu sampai selesai, lalu ulangi.
10. Bila seri BPS gagal (kodenya tampil di ringkasan run):
    - "BPS_API_KEY belum diisi" atau "format BPS_API_KEY tidak valid": Secret `BPS_API_KEY` tidak sampai ke langkah Pipeline, atau isinya salah (bagian 2).
    - "status bukan OK", "dimensi berubah", "kode tidak dikenal", "kolom berubah", atau "tanpa data": susunan tabel BPS berubah. Cek variabelnya (id di `config/series.toml`) di webapi.bps.go.id. Bila BPS mengganti tahun dasar atau memindahkan data ke variabel baru, tambahkan seri baru, atau satu item ` + ` baru di query seri itu.
    - "y-to-d tidak cocok" atau "bulan tidak lengkap" di seri `bps_cpi_*_mom_m`: ada sel keliru atau bulan bolong di tabel statis 908, jadi seri itu tertahan di angka terakhir yang baik. Bandingkan baris tahun itu dengan rilis pers BPS, lalu tunggu BPS membetulkan tabelnya. Jangan melonggarkan `BPS_YTD_TOLERANCE` di `confore/fetch.py`, karena satu sel keliru merusak y-on-y setahun penuh.
    - Bila BPS mengganti tahun dasar IHK (terakhir Januari 2024), rangkaian y-on-y kelompok melewati dua tahun dasar selama 11 bulan dan bisa menyimpang sekitar 0,3 poin persen dari rilis. Naikkan tahun `sejak` di keempat query tabel 908 ke tahun dasar baru, dengan akibat angka setahun per kelompok kosong selama 11 bulan.
    - `HTTP 429`: kuota WebAPI terlampaui. Tunggu run berikutnya dan jangan menjalankan banyak run manual berdekatan.

## 5. Menayangkan situs pertama kali (fase 2)

Situs ada di folder `web/`. Vercel membangunnya dari branch `main`, jadi kerjakan berurutan.

1. **Gabungkan branch `v0.1-tab-data` ke `main`** (sudah dilakukan 2026-10-31). Sebelumnya, pastikan Secret `BPS_API_KEY` ada di GitHub (bagian 2; baris BPS di uji akses bagian 3 berhasil). Merge ini mengubah `config/**`, jadi langsung memicu satu run **Pipeline data** yang menambahkan tiga seri BPS ke Supabase. Tunggu run itu selesai di tab Actions dengan status `ok` atau `partial`. Mulai saat itu jadwal hari rilis BPS (tanggal 1-8) juga aktif.
2. Buat nilai acak untuk `REVALIDATE_SECRET` dan `HEALTH_TOKEN` dengan perintah di bagian 2, satu per variabel.
3. Di vercel.com: **Add New > Project**, pilih repo GitHub Con-Fore, lalu **Import**.
4. Di layar konfigurasi, isi **Root Directory** dengan `web` (Framework terdeteksi sebagai Next.js). Di **Environment Variables**, isi empat variabel ini dengan nama persis dan nilai tanpa spasi atau tanda kutip:
   - `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY`: sama dengan di `.env`.
   - `REVALIDATE_SECRET` dan `HEALTH_TOKEN`: nilai dari langkah 2.
   Jangan beri awalan `NEXT_PUBLIC_`. Tanpa awalan itu, nilainya hanya dibaca server dan tidak pernah sampai ke browser pengunjung. Jangan impor seluruh `.env`: situs tidak memakai `SUPABASE_DB_URL` (memuat password database) maupun key BPS dan FRED.
5. Klik **Deploy**. Build ikut membaca Supabase, jadi keempat variabel harus terisi dulu dan proyek Supabase tidak sedang dijeda. Region fungsi (`icn1`, Seoul) dan aturan "build hanya bila `web/` berubah" diambil otomatis dari `web/vercel.json`; tidak perlu diatur di dashboard.
6. Buka alamat `<nama-proyek>.vercel.app` dari Vercel. Cek bahwa `/`, `/sumber`, dan satu halaman `/indikator/...` tampil dengan angka. Domain sendiri belum diputuskan (PRD 9.2), jadi subdomain Vercel dipakai dulu.
Bila build gagal dengan `PYTHON_ENTRYPOINT_NOT_FOUND`, Vercel membangun dari akar repo (ada `requirements.txt`, jadi dikira proyek Python). Di proyek Vercel: **Settings > Build and Deployment > Root Directory** isi `web`, pastikan Framework Preset menjadi Next.js, simpan, lalu Redeploy seperti di bawah.

Perubahan variabel environment baru berlaku di deployment baru. Untuk Redeploy: **Deployments**, ⋯ di deployment teratas, **Redeploy**, matikan centang **Use project's Ignore Build Step**, lalu konfirmasi. Centang itu harus mati, karena commit yang sama tidak mengubah `web/`. Tanda berhasil: `GET /api/health` tanpa token menjawab 401, bukan 503.

7. Tambahkan dua Secret di GitHub (bagian 2): `REVALIDATE_SECRET` dengan nilai yang sama seperti di Vercel, dan `SITE_URL` berisi alamat situs yang diawali `https://`. Setiap run lalu menyegarkan situs, dan hasilnya muncul sebagai tabel "Revalidasi situs" di ringkasan job. `HEALTH_TOKEN` masuk cron-job.org saat pemeriksaan kesehatan dipasang.

Bila run berakhir merah dengan `Revalidasi situs gagal`, datanya tetap sudah terbit. Artinya: `HTTP 401` berarti nilai di GitHub dan Vercel berbeda, `HTTP 503` berarti Vercel belum memuat rahasia itu (Redeploy), dan `Secret ... belum diisi` berarti Secret-nya belum ada di GitHub.

## 6. Workflow terjadwal berhenti (mulai jadwal harian aktif)

Tanda: issue `pipeline-failure`, email cron-job.org, atau banner "data mungkin belum diperbarui".

1. Buka tab **Actions**. Bila workflow berstatus disabled (aturan 60 hari di repo publik), pilih workflow lalu **Enable workflow**.
2. Jalankan workflow secara manual (**Run workflow**). Run otomatis mengejar data yang terlewat.
3. Cek job cron-job.org yang memanggil endpoint `enable` setiap hari: masih aktif dan token-nya belum kedaluwarsa.

## 7. Supabase dijeda (mulai fase 1)

Supabase Free dijeda setelah satu minggu tanpa aktivitas.

1. Buka dashboard Supabase dan pulihkan proyek.
2. Jalankan pipeline secara manual.
3. Baru setelah itu deploy ulang situs, karena build Vercel ikut membaca Supabase.

## 8. Rotasi kredensial

Lakukan bila kredensial bocor atau terpapar (tertempel di chat, log, atau commit).

| Kredensial | Langkah |
|---|---|
| Password database | Dashboard Supabase > pengaturan Database > reset password. Perbarui `SUPABASE_DB_URL` di GitHub Secrets dan `.env` |
| Key BPS | Buat key baru di akun webapi.bps.go.id, hapus yang lama. Perbarui `BPS_API_KEY` di GitHub Secrets (dipakai `pipeline.yml` dan `smoke.yml`) dan `.env` |
| Key FRED | Buat key baru di akun FRED, hapus yang lama. Perbarui `FRED_API_KEY` |
| `REVALIDATE_SECRET`, `HEALTH_TOKEN` (fase 2) | Buat nilai baru (lihat bagian 2), perbarui di GitHub, Vercel, dan cron-job.org sekaligus, lalu Redeploy situs (bagian 5) |
| Token GitHub untuk cron-job.org (fase 1) | Buat token fine-grained baru (repo ini saja, Actions: write), ganti di cron-job.org, cabut yang lama |
| Kunci Supabase | Publishable key baru di dashboard; nonaktifkan legacy `anon` dan `service_role` bila masih aktif |

- Terpapar di log atau ringkasan Actions: rotasi, lalu hapus run tersebut dari tab Actions.
- Terlanjur masuk commit: **rotasi dulu**. Membersihkan riwayat tidak cukup di repo publik, karena salinannya mungkin sudah diambil orang.
- Setelah rotasi, jalankan uji akses (bagian 3).

## 9. Pemeriksaan bulanan

- [ ] Ada pull request Dependabot untuk action yang perlu diperbarui.
- [ ] Perbarui lockfile Python bila ada rilis keamanan: `uv pip compile requirements.in --universal --python-version 3.12 --generate-hashes -o requirements.txt`, lalu jalankan tes.
- [ ] (Fase 1) Job cron-job.org masih aktif dan notifikasi email kegagalan menyala.
- [ ] (Fase 1) Tanggal kedaluwarsa token GitHub untuk cron-job.org: `____-__-__`. Perbarui sebelum lewat.
- [ ] (Fase 1) Ukuran database Supabase di bawah 300 MB; ada aset backup baru di GitHub Releases.
- [ ] (Fase 2) Pemakaian Vercel Hobby masih jauh dari batas.
- [ ] (Fase 2) Rencana Terbit BPS (https://www.bps.go.id/id/arc) sudah memuat tahun berikutnya: ganti baris `bps-perkiraan` di `config/release_calendar.csv` dengan tanggal resminya, dan tambahkan rilis yang belum tercatat.
- [ ] (Fase 2) Naskah UU APBN 2027 sudah ada di JDIH: cocokkan dua baris `berita` di `config/targets.csv`.
