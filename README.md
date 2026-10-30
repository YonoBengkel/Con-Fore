# Con-Fore

Website publik berbahasa Indonesia yang menjelaskan kondisi dan arah ekonomi Indonesia lewat tiga angka (pertumbuhan, inflasi, pengangguran), diperbarui otomatis setiap hari.

Status: fase 1 (pipeline data). Belum ada situs yang tayang.

## Dokumen

- [PRD.md](PRD.md): masalah, pengguna, ruang lingkup, dan ukuran keberhasilan.
- [ARCHITECTURE.md](ARCHITECTURE.md): komponen, alur data, dan lapisan teknis.
- [SCHEMA.md](SCHEMA.md): tabel, relasi, dan kebijakan akses database.
- [RUNBOOK.md](RUNBOOK.md): langkah operasional dan pemulihan.

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

Variabel environment dibaca dari environment atau `.env` (lihat `.env.example`). Tes database butuh Postgres lokal sekali pakai dengan peran `anon`, `authenticated`, dan `service_role`; arahkan `CONFORE_TEST_DB_URL` ke database berakhiran `_test` sebagai variabel environment (bukan lewat `.env`), misalnya `postgresql://postgres@localhost:55432/confore_test?sslmode=disable`. Tes itu menghapus skema `etl` dan tabel `public` di database tersebut. Seri yang ditarik diatur di `config/series.toml`; target resmi, sumber, dan kalender rilis di `config/*.csv`.

## Sumber data

Data berasal dari IMF, BIS, OECD, dan ECB; BPS menyusul setelah key-nya ada. Atribusi lengkap ditampilkan di halaman Sumber data situs. Situs ini bukan situs resmi lembaga mana pun.
