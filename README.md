# Con-Fore

Website publik berbahasa Indonesia yang menjelaskan kondisi dan arah ekonomi Indonesia lewat tiga angka (pertumbuhan, inflasi, pengangguran), diperbarui otomatis setiap hari.

Status: fase 0 (persiapan). Belum ada situs yang tayang.

## Dokumen

- [PRD.md](PRD.md): masalah, pengguna, ruang lingkup, dan ukuran keberhasilan.
- [ARCHITECTURE.md](ARCHITECTURE.md): komponen, alur data, dan lapisan teknis.
- [SCHEMA.md](SCHEMA.md): tabel, relasi, dan kebijakan akses database.
- [RUNBOOK.md](RUNBOOK.md): langkah operasional dan pemulihan.

## Menjalankan uji akses sumber

Butuh Python 3.12 atau lebih baru, tanpa paket tambahan. Jalankan dari folder repo (pakai `python3` di Linux dan macOS):

```
python -m unittest discover -s tests
python -m confore.smoke
```

Uji akses membaca `BPS_API_KEY` dan `FRED_API_KEY` dari environment atau `.env` (lihat `.env.example`); sumber yang key-nya belum ada dilewati.

## Sumber data

Data berasal dari IMF, BPS, BIS, OECD, ECB (lewat Frankfurter untuk kurs tampilan), dan World Bank. Atribusi lengkap ditampilkan di halaman Sumber data situs. Situs ini bukan situs resmi lembaga mana pun.
