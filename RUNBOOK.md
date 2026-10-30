Status: plan (disusun di fase 0; langkah untuk komponen yang belum ada dicek ulang saat komponennya jadi)

# Runbook Con-Fore

Langkah operasional dan pemulihan. Arsitekturnya ada di [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Sebelum commit pertama

1. Hapus `docs/RENCANA-MVP.md` dan `docs/ARSITEKTUR.md` (berisi data asli dan catatan pribadi), lalu hapus dua baris pengamannya di `.gitignore`.
2. Pastikan `.env` tidak ikut: `git check-ignore -v .env` harus menunjuk ke `.gitignore`, dan `git status` tidak menampilkan `.env`.
3. Di GitHub, nyalakan **Settings > Code security > Secret scanning** dan **Push protection**. Catatan: secret scanning GitHub tidak mengenali key BPS dan FRED, jadi langkah 2 tetap wajib.

## 2. Menyimpan kredensial

- Salin string **Session pooler** dari tombol Connect di dashboard Supabase langsung ke GitHub Secrets (`SUPABASE_DB_URL`) dan `.env` laptop. Jangan lewat chat, issue, atau commit.
- GitHub: **Settings > Secrets and variables > Actions**. Rahasia sebagai Secrets; nilai yang tidak rahasia (misalnya `SUPABASE_URL`) boleh sebagai Variables.
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

## 4. Workflow terjadwal berhenti (mulai fase 1)

Tanda: issue `pipeline-failure`, email cron-job.org, atau banner "data mungkin belum diperbarui".

1. Buka tab **Actions**. Bila workflow berstatus disabled (aturan 60 hari di repo publik), pilih workflow lalu **Enable workflow**.
2. Jalankan workflow secara manual (**Run workflow**). Run otomatis mengejar data yang terlewat.
3. Cek job cron-job.org yang memanggil endpoint `enable` setiap hari: masih aktif dan token-nya belum kedaluwarsa.

## 5. Supabase dijeda (mulai fase 1)

Supabase Free dijeda setelah satu minggu tanpa aktivitas.

1. Buka dashboard Supabase dan pulihkan proyek.
2. Jalankan pipeline secara manual.
3. Baru setelah itu deploy ulang situs, karena build Vercel ikut membaca Supabase.

## 6. Rotasi kredensial

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

## 7. Pemeriksaan bulanan

- [ ] Ada pull request Dependabot untuk action yang perlu diperbarui.
- [ ] (Fase 1) Job cron-job.org masih aktif dan notifikasi email kegagalan menyala.
- [ ] (Fase 1) Tanggal kedaluwarsa token GitHub untuk cron-job.org: `____-__-__`. Perbarui sebelum lewat.
- [ ] (Fase 1) Ukuran database Supabase di bawah 300 MB; ada aset backup baru di GitHub Releases.
- [ ] (Fase 2) Pemakaian Vercel Hobby masih jauh dari batas.
