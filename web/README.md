# Situs Con-Fore (web)

Situs Next.js (App Router, runtime Node) untuk tab Data v0.1. Membaca tabel `public` Supabase lewat Data API di server, lalu menyajikan halaman yang di-cache (ISR 6 jam). Browser pengunjung tidak pernah memanggil Supabase. Rancangannya ada di [ARCHITECTURE.md](../ARCHITECTURE.md) bagian 4.1, 4.2, 4.9, dan 4.10.

## Menjalankan

Butuh Node 24. Dari folder `web/`:

```
npm ci                 # pasang dependensi persis dari package-lock.json
npm run salin-env      # salin SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY dari ../.env ke .env.local
npm test               # tes aturan skor segitiga (node --test)
npm run dev            # situs lokal di http://localhost:3000
npm run build          # build produksi; ikut membaca Supabase, jadi Supabase harus aktif
npm start              # sajikan hasil build
```

`.env.local` diabaikan git (pola `.env.*` di `.gitignore` akar). `REVALIDATE_SECRET` dan `HEALTH_TOKEN` hanya diisi di Vercel, atau di environment proses saat menguji; daftar lengkapnya di `.env.example`.

## Halaman dan route

| Alamat | Isi |
|---|---|
| `/` | Tab Data: segitiga keseimbangan (lensa masa lalu, atau target lewat `?lensa=target`), tiga angka utama, panel penggerak, target resmi |
| `/indikator/[id]` | Detail satu seri: riwayat panjang, 12 angka terakhir, jadwal rilis berikutnya, target terkait, unduh CSV. Hanya id yang dibangun saat build (seri di `series_meta` plus `SERI_DITAUTKAN`); id lain 404 tanpa render |
| `/sumber` | Sumber data, kalimat atribusi wajib, syarat penggunaan, dan semua target resmi dengan status pemeriksaannya |
| `/cara-kerja` | Asal data, arti label, dan aturan skor dalam bahasa sehari-hari |
| `/prediksi` | Penanda tab Prediksi (v0.2, segera) |
| `GET /api/csv/[chart_id]` | CSV dari `public.chart_series`, dengan sumber dan syarat di baris `#` awal |
| `POST /api/revalidate` | Menandai semua halaman yang membaca Supabase sebagai basi (`revalidateTag("supabase", "max")`): permintaan berikutnya masih mendapat halaman lama sambil halaman baru dirender di latar, dan bila Supabase gagal, halaman lama dipertahankan; wajib header `x-revalidate-secret` |
| `GET /api/health` | 200 bila run sukses terakhir paling lama 36 jam lalu, 503 bila lebih atau Supabase tidak terbaca; wajib header `x-health-token`; `Cache-Control: private, no-store` |

## Peta folder

```
app/            halaman dan route API
components/     Segitiga (SVG), Grafik (garis kecil dan riwayat), Kartu (kartu angka, tabel target), Klien (banner basi, pilihan lensa, navigasi)
lib/data.ts     pembacaan Data API (fetch biasa, melempar error bila gagal atau tabel wajib kosong)
lib/skor.ts     aturan skor segitiga PRD 4.2 (fungsi murni, dites di skor.test.ts)
lib/konten.ts   seri untuk tiga kartu (SERI_KARTU), panel penggerak, label, penjelasan "artinya buatmu"
lib/format.ts   format angka, periode, dan tanggal Indonesia
scripts/        salin-env.mjs
vercel.json     region icn1 (Seoul, dekat Supabase) dan build hanya bila web/ berubah sejak deploy terakhir (VERCEL_GIT_PREVIOUS_SHA)
```

Pindah ke seri BPS untuk tiga kartu cukup mengubah `SERI_KARTU` di `lib/konten.ts`, misalnya `inflasi: ["bps_cpi_yoy_m", "idn_cpi_yoy_m"]`. Seri yang belum ada di database dilewati, dan kartu tanpa seri menampilkan "Data belum tersedia".

Halaman `/indikator/[id]` dan `/api/csv/[chart_id]` memakai `dynamicParams = false`, jadi alamat dengan id karangan tidak menulis cache ISR. Seri di `SERI_KARTU` dan `PENGGERAK` selalu dibangun (sebagai 404 sampai datanya terbit, lalu hidup setelah revalidasi). Seri baru lain baru mendapat halaman setelah build web berikutnya.
