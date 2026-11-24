# Situs Con-Fore (web)

Situs Next.js (App Router, runtime Node) hasil desain ulang (fase 5c di PRD): halaman depan dengan globe, halaman Indonesia, tiga halaman rinci, Ke depan, Tentang data, dan halaman data per seri. Membaca tabel `public` Supabase lewat Data API di server, lalu menyajikan halaman yang di-cache (ISR 6 jam). Browser pengunjung tidak pernah memanggil Supabase. Rancangannya ada di [ARCHITECTURE.md](../ARCHITECTURE.md) bagian 4.1, 4.2, 4.9, dan 4.10, dan tampilannya di [DESIGN.md](../DESIGN.md).

## Menjalankan

Butuh Node 24. Dari folder `web/`:

```
npm ci                 # pasang dependensi persis dari package-lock.json
npm run salin-env      # salin SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY dari ../.env ke .env.local
npm test               # tes jawaban, perbandingan, perkiraan, dan isi lain (node --test)
npm run dev            # situs lokal di http://localhost:3000
npm run build          # build produksi; ikut membaca Supabase, jadi Supabase harus aktif
npm start              # sajikan hasil build
```

`.env.local` diabaikan git (pola `.env.*` di `.gitignore` akar). `REVALIDATE_SECRET` dan `HEALTH_TOKEN` hanya diisi di Vercel, atau di environment proses saat menguji; daftar lengkapnya di `.env.example`.

## Halaman dan route

| Alamat | Isi |
|---|---|
| `/` | Judul dan globe kanvas yang bisa diseret, dengan Indonesia sebagai satu-satunya negara yang tersedia. Peta dunia diam tampil bila JavaScript mati atau kanvas gagal. Tidak membaca Supabase |
| `/indonesia` | Ringkasan bercerita, baris empat pertanyaan, lalu blok jawaban Harga, Kerja, Ekonomi, dan Ke depan |
| `/indonesia/harga`, `/indonesia/kerja`, `/indonesia/ekonomi` | Halaman rinci (route `[topik]`, `dynamicParams = false`): jawaban dan perbandingan, grafik riwayat, rincian khusus, yang ikut memengaruhi, satu kalimat perkiraan, lalu penjelas, sumber, dan waktu data |
| `/indonesia/ke-depan` | Tiga perkiraan dengan rentang dan grafik kipas, seberapa sering meleset, pembanding proyeksi IMF, dan jangka panjang. Bila `public.forecast_latest` kosong, halamannya menjelaskan bahwa perkiraan belum tersedia |
| `/tentang-data` | Arti label, kapan diperbarui, asal angka, cara perbandingan dan perkiraan dihitung, hasil uji dengan data lama, sumber dan syarat, target resmi, dan unduhan |
| `/indikator/[id]` | Data satu seri: penjelas empat bagian, riwayat dengan penggeser, 12 angka terakhir, jadwal rilis berikutnya, target terkait, unduh CSV. Hanya id yang dibangun saat build (seri di `series_meta` plus `SERI_DITAUTKAN`); id lain 404 tanpa render |
| `/prediksi`, `/metode`, `/cara-kerja`, `/sumber` | Alamat lama, dialihkan permanen (308) ke `/indonesia/ke-depan` dan `/tentang-data` |
| `/sitemap.xml`, `/robots.txt` | Daftar halaman untuk mesin pencari, dengan `lastModified` dari `latest_values` dan `forecast_latest`. `/api/` ditutup untuk perayap |
| `GET /api/csv/[chart_id]`, `GET /api/csv/perkiraan/[kunci]` | CSV dari `public.chart_series` dan `public.forecast_latest`, dengan sumber dan syarat di baris `#` awal |
| `POST /api/revalidate` | Menandai semua halaman yang membaca Supabase sebagai basi (`revalidateTag("supabase", "max")`): permintaan berikutnya masih mendapat halaman lama sambil halaman baru dirender di latar, dan bila Supabase gagal, halaman lama dipertahankan; wajib header `x-revalidate-secret` |
| `GET /api/health` | 200 bila run sukses terakhir paling lama 36 jam lalu, 503 bila lebih atau Supabase tidak terbaca; wajib header `x-health-token`; `Cache-Control: private, no-store` |

## Peta folder

```
app/              halaman dan route API
components/       Globe (globe halaman depan), Peta (peta dunia diam), BarisTanya (baris empat pertanyaan),
                  Jawaban (isi jawaban dan ringkasan bercerita), Rincian (kelompok harga dan pekerja formal), Grafik
                  (garis kecil, riwayat, per ronde, per kelompok, perkiraan, jangka panjang), Kartu (kartu angka, sitasi,
                  tabel target), RiwayatInteraktif (penggeser riwayat), Berikutnya, JsonLd, Klien (menu utama dan banner
                  basi)
lib/data.ts       pembacaan Data API (fetch biasa, melempar error bila gagal atau tabel wajib kosong)
lib/muat.ts       pemuatan data bersama halaman Indonesia dan halaman rinci
lib/jawaban.ts    jawaban, label, contoh, perbandingan dalam kalimat, dan ringkasan bercerita (dites di jawaban.test.ts)
lib/konten.ts     empat pertanyaan (TOPIK), seri angka utama (SERI_KARTU), seri tahunan patokan, label, "artinya buatmu"
lib/peta.ts       jalur SVG peta dunia sederhana, gambar diam pengganti globe
lib/globe.ts      hitungan globe: memisahkan Indonesia, jalur yang digambar, sudut putar, seretan, lemparan, angkatan,
                  dan uji kena (dites di globe.test.ts)
lib/gambar-globe.ts  menggambar globe di kanvas, dimuat lewat import() hanya di halaman depan
lib/pekerja.ts    kalimat otomatis pekerja formal dan informal PRD 4.4 (dites di pekerja.test.ts)
lib/rincian.ts    kalimat dan tabel kelompok harga PRD 4.4 (dites di rincian.test.ts)
lib/prediksi.ts   angka utama, angka tahunan, dan kalimat perkiraan (dites di prediksi.test.ts)
lib/penjelas.ts   penjelas tiga bagian per jenis seri
lib/riwayat.ts    titik riwayat dengan pembandingnya, kalimat per periode, judul temuan, dan kesimpulan riwayat
lib/format.ts     format angka, periode, dan tanggal Indonesia
lib/jsonld.ts     data terstruktur schema.org; lib/csv.ts baris kepala CSV; lib/situs.ts alamat produksi
scripts/          salin-env.mjs
types/geo.d.ts    deklarasi tipe secukupnya untuk d3-geo dan topojson-client
vercel.json       region icn1 (Seoul, dekat Supabase) dan build hanya bila web/ berubah sejak deploy terakhir (VERCEL_GIT_PREVIOUS_SHA)
```

Pindah ke seri lain untuk satu pertanyaan cukup mengubah `SERI_KARTU` di `lib/konten.ts`, misalnya `inflasi: ["bps_cpi_yoy_m", "idn_cpi_yoy_m"]`. Seri yang belum ada di database dilewati, dan blok tanpa seri menulis bahwa angkanya belum tersedia.

Halaman `/indikator/[id]` dan `/api/csv/[chart_id]` memakai `dynamicParams = false`, jadi alamat dengan id karangan tidak menulis cache ISR. Seri di `SERI_DITAUTKAN` (angka utama, yang ikut memengaruhi, porsi pekerja formal, dan angka setahun kelompok harga) selalu dibangun (sebagai 404 sampai datanya terbit, lalu hidup setelah revalidasi). Seri baru lain baru mendapat halaman setelah build web berikutnya.
