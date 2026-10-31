# Con-Fore

Website publik berbahasa Indonesia yang menjelaskan kondisi dan arah ekonomi Indonesia lewat tiga angka (pertumbuhan, inflasi, pengangguran), diperbarui otomatis setiap hari.

Status: fase 1 (pipeline data) jalan otomatis setiap hari. Fase 2 (situs tab Data v0.1 di `web/`) dan pengambil data BPS sudah di `main`; situs belum tayang.

## Dokumen

- [PRD.md](PRD.md): masalah, pengguna, ruang lingkup, dan ukuran keberhasilan.
- [ARCHITECTURE.md](ARCHITECTURE.md): komponen, alur data, dan lapisan teknis.
- [SCHEMA.md](SCHEMA.md): tabel, relasi, dan kebijakan akses database.
- [RUNBOOK.md](RUNBOOK.md): langkah operasional dan pemulihan.
- [DESIGN.md](DESIGN.md): panduan tampilan situs.
- [web/README.md](web/README.md): halaman, route, dan cara menjalankan situs.

## Menjalankan

Butuh Python 3.12 atau lebih baru. Dari folder repo (pakai `python3` di Linux dan macOS):

```
python -m venv .venv
.venv\Scripts\python -m pip install --require-hashes -r requirements.txt     # Windows
.venv/bin/python -m pip install --require-hashes -r requirements.txt         # Linux dan macOS
```

Perintah (dengan Python dari `.venv`):

```
python -m unittest discover -s tests       # tes; tes database dilewati tanpa CONFORE_TEST_DB_URL
python -m confore.smoke                    # uji akses setiap sumber, tanpa paket tambahan
python -m confore run --dry-run            # ambil dan hitung semua seri tanpa database
python -m confore migrate                  # terapkan migrasi SQL ke Supabase, lalu uji akses
python -m confore run                      # ambil data, simpan vintage baru, publikasi public.*
```

Variabel environment dibaca dari environment atau `.env` (lihat `.env.example`). Tes database butuh Postgres lokal sekali pakai dengan peran `anon`, `authenticated`, dan `service_role`; arahkan `CONFORE_TEST_DB_URL` ke database berakhiran `_test` sebagai variabel environment (bukan lewat `.env`), misalnya `postgresql://postgres@localhost:55432/confore_test?sslmode=disable`. Tes itu menghapus skema `etl` dan tabel `public` di database tersebut. Seri yang ditarik diatur di `config/series.toml`; target resmi, sumber, dan kalender rilis di `config/*.csv`. Seri BPS butuh `BPS_API_KEY` di `.env`.

### Situs lokal

Butuh Node 24. Dari folder `web/`:

```
npm ci                 # pasang dependensi persis dari package-lock.json
npm run salin-env      # salin SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY dari ../.env ke web/.env.local
npm test               # tes aturan skor segitiga
npm run dev            # situs lokal di http://localhost:3000
npm run build          # build produksi; ikut membaca Supabase, jadi Supabase harus aktif
npm start              # sajikan hasil build
```

`web/.env.local` diabaikan git. Penjelasan halaman dan route ada di [web/README.md](web/README.md).

## Sumber data

Data berasal dari BPS (lewat WebAPI), IMF, BIS, OECD, dan ECB. Layanan ini menggunakan API Badan Pusat Statistik (BPS). Atribusi lengkap ditampilkan di halaman Sumber data situs dan di setiap unduhan CSV. Situs ini bukan situs resmi BPS atau lembaga mana pun.
