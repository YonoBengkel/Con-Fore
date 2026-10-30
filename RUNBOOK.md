Status: plan (disusun di fase 0, diperbarui fase 1; langkah untuk komponen yang belum ada dicek ulang saat komponennya jadi)

# Runbook Con-Fore

Langkah operasional dan pemulihan. Arsitekturnya ada di [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Sebelum setiap commit

1. Pastikan `.env` tidak ikut: `git check-ignore -v .env` harus menunjuk ke `.gitignore`, dan `git status` tidak menampilkan `.env` atau `.venv/`.
2. Stage berkas satu per satu, jangan `git add .`.
3. Secret scanning dan push protection repo sudah menyala sejak 2026-10-30 (Settings repo > Security and quality > Advanced Security). Secret scanning GitHub tidak mengenali key BPS dan FRED, jadi langkah 1 tetap wajib.

## 2. Menyimpan kredensial

- Salin string **Session pooler** dari tombol Connect di dashboard Supabase langsung ke GitHub Secrets (`SUPABASE_DB_URL`) dan `.env` laptop. Jangan lewat chat, issue, atau commit.
- GitHub: **Settings > Secrets and variables > Actions > Secrets**. `pipeline.yml` membaca `SUPABASE_DB_URL`, `SUPABASE_URL`, dan `SUPABASE_PUBLISHABLE_KEY` sebagai Secrets. `SUPABASE_URL` tidak rahasia, tetapi memuat ref proyek yang sengaja tidak ditampilkan di log publik.
- Nilai disimpan tanpa spasi atau tanda kutip di sekitarnya; uji akses menolak key yang formatnya tidak valid.
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
5. Setelah run manual dari runner lulus, tambahkan jadwal harian ke `pipeline.yml` (lihat ARCHITECTURE.md, Jadwal penarikan).
6. Pengaturan sekali jalan: di dashboard Supabase, matikan pendaftaran pengguna baru (Authentication > Sign In / Providers), karena situs tanpa login; di repo GitHub, nyalakan **Dependabot alerts** (Settings > Security and quality > Advanced Security) supaya rilis keamanan psycopg di `requirements.txt` terlihat.
7. Bila sebuah run perlu menulis ulang semua observasi (tabel diubah manual atau dipulihkan dari backup), jalankan workflow dengan mode `full_refresh`, atau `python -m confore run --full-refresh`.
8. Bila ringkasan run menunjukkan "terlalu banyak periode hilang", sumber memotong riwayat seri itu. Cek dulu di portal sumbernya. Bila memang disengaja sumber, jalankan mode `full_refresh` untuk menerimanya; bila tidak, biarkan (run berikutnya mencoba lagi, dan setelah tiga kali gagal run ditandai `failed`).
9. Pesan "run atau migrasi lain sedang berjalan" berarti ada run lain (laptop atau GitHub) yang memegang kunci database. Tunggu sampai selesai, lalu ulangi.

## 5. Workflow terjadwal berhenti (mulai jadwal harian aktif)

Tanda: issue `pipeline-failure`, email cron-job.org, atau banner "data mungkin belum diperbarui".

1. Buka tab **Actions**. Bila workflow berstatus disabled (aturan 60 hari di repo publik), pilih workflow lalu **Enable workflow**.
2. Jalankan workflow secara manual (**Run workflow**). Run otomatis mengejar data yang terlewat.
3. Cek job cron-job.org yang memanggil endpoint `enable` setiap hari: masih aktif dan token-nya belum kedaluwarsa.

## 6. Supabase dijeda (mulai fase 1)

Supabase Free dijeda setelah satu minggu tanpa aktivitas.

1. Buka dashboard Supabase dan pulihkan proyek.
2. Jalankan pipeline secara manual.
3. Baru setelah itu deploy ulang situs, karena build Vercel ikut membaca Supabase.

## 7. Rotasi kredensial

Lakukan bila kredensial bocor atau terpapar (tertempel di chat, log, atau commit).

| Kredensial | Langkah |
|---|---|
| Password database | Dashboard Supabase > pengaturan Database > reset password. Perbarui `SUPABASE_DB_URL` di GitHub Secrets dan `.env` |
| Key BPS | Buat key baru di akun webapi.bps.go.id, hapus yang lama. Perbarui `BPS_API_KEY` |
| Key FRED | Buat key baru di akun FRED, hapus yang lama. Perbarui `FRED_API_KEY` |
| `REVALIDATE_SECRET`, `HEALTH_TOKEN` (fase 2) | Buat nilai baru (lihat bagian 2), perbarui di GitHub, Vercel, dan cron-job.org sekaligus |
| Token GitHub untuk cron-job.org (fase 1) | Buat token fine-grained baru (repo ini saja, Actions: write), ganti di cron-job.org, cabut yang lama |
| Kunci Supabase | Publishable key baru di dashboard; nonaktifkan legacy `anon` dan `service_role` bila masih aktif |

- Terpapar di log atau ringkasan Actions: rotasi, lalu hapus run tersebut dari tab Actions.
- Terlanjur masuk commit: **rotasi dulu**. Membersihkan riwayat tidak cukup di repo publik, karena salinannya mungkin sudah diambil orang.
- Setelah rotasi, jalankan uji akses (bagian 3).

## 8. Pemeriksaan bulanan

- [ ] Ada pull request Dependabot untuk action yang perlu diperbarui.
- [ ] Perbarui lockfile Python bila ada rilis keamanan: `uv pip compile requirements.in --universal --python-version 3.12 --generate-hashes -o requirements.txt`, lalu jalankan tes.
- [ ] (Fase 1) Job cron-job.org masih aktif dan notifikasi email kegagalan menyala.
- [ ] (Fase 1) Tanggal kedaluwarsa token GitHub untuk cron-job.org: `____-__-__`. Perbarui sebelum lewat.
- [ ] (Fase 1) Ukuran database Supabase di bawah 300 MB; ada aset backup baru di GitHub Releases.
- [ ] (Fase 2) Pemakaian Vercel Hobby masih jauh dari batas.
