# PRD Con-Fore

> Status: disetujui pengelola 2026-10-30. Menggantikan `docs/RENCANA-MVP.md`. Detail teknis ada di [ARCHITECTURE.md](ARCHITECTURE.md) dan [SCHEMA.md](SCHEMA.md).

## 1. Masalah

Data ekonomi Indonesia tersebar di banyak lembaga (BPS, Bank Indonesia, IMF, OECD), terbit dengan jadwal yang berbeda-beda, dan disajikan untuk analis. Pembaca awam sulit menjawab pertanyaan sederhana: "Ekonomi kita sedang bagaimana, dan ke mana arahnya?" Con-Fore ingin menjawabnya dalam bahasa sehari-hari, dan menyajikan setiap perkiraan bersama rentang ketidakpastian dan catatan seberapa sering perkiraan itu meleset.

## 2. Pengguna

| Pengguna | Kebutuhan |
|---|---|
| **Utama:** publik awam Indonesia, diasumsikan banyak membuka dari HP (belum diukur) | Memahami kondisi dan arah ekonomi lewat tiga angka (pertumbuhan, inflasi, pengangguran) |
| **Kedua:** pembaca yang ingin menggali lebih dalam | Data olahan yang bisa diunduh, lengkap dengan sumber dan tanggal rilisnya |
| **Pengelola:** satu orang (pemilik repo) | Sistem yang berjalan sendiri setiap hari tanpa dirawat manual dan tanpa biaya |

## 3. Solusi singkat

Website publik berbahasa Indonesia yang online 24/7 dan diperbarui otomatis setiap hari, dengan dua tab:

- **Tab Data (beranda):** kondisi terkini dari data resmi yang sudah diolah ("semi-mentah"). Tab ini tidak memuat ramalan.
- **Tab Prediksi:** perkiraan berlabel jelas, lengkap dengan penjelasan, rentang ketidakpastian, dan rekam jejak.

Ringkasan di kedua tab berupa **segitiga keseimbangan** (pertumbuhan, harga stabil, lapangan kerja), **kalimat ringkasan otomatis**, dan **tiga kartu angka**. Pengunjung bisa memilih dua lensa skor: dibanding masa lalu atau dibanding target resmi.

## 4. Ruang lingkup MVP

- **Negara:** Indonesia.
- **Target:** pertumbuhan PDB riil, inflasi IHK, dan tingkat pengangguran terbuka (TPT).
- **Horizon pendek:** nowcast kuartal berjalan dan forecast sampai akhir tahun depan untuk PDB dan inflasi; dua rilis TPT berikutnya.
- **Horizon panjang:** proyeksi IMF WEO sampai tahun terakhir yang tersedia (kini 2031), diberi label "proyeksi IMF", plus panel target RPJMN dibanding proyeksi. Panel itu terpisah dari segitiga karena target RPJMN berada di atas rekor 2000-2025.
- **Rilis bertahap:** v0.1 hanya tab Data, karena tidak butuh model; v0.2 menambah tab Prediksi. v0.1 baru dirilis publik setelah key BPS terbukti jalan; sebelum itu situs hanya untuk pengembangan.

### 4.1 Isi halaman

**Tab Data (beranda)**

- Ringkasan: segitiga khusus tahun yang sudah punya data resmi, kalimat ringkasan, pilihan lensa.
- Tiga angka utama dengan grafik kecil.
- Panel penggerak: harga komoditas, kurs, BI-Rate, indikator pendahulu OECD, mitra dagang.
- Tabel target resmi beserta sumbernya.
- Untuk setiap angka: sumber, tanggal rilis, penjelasan "artinya buatmu", dan tombol unduh CSV.

**Tab Prediksi**

- Segitiga dengan tahun perkiraan (garis putus-putus) dan kalimat ringkasannya.
- Forecast ketiga target beserta rentangnya, dan penjelasan "kenapa perkiraannya begini" berupa penggerak terbesar dalam bahasa awam.
- Panel jangka panjang (proyeksi IMF dibanding target RPJMN) dan bagian Rekam jejak.
- Selalu berangkat dari angka resmi terakhir.

**Halaman pendukung**

- Detail per target (dibuka dari kartu): riwayat panjang dan jadwal rilis berikutnya.
- Cara kerja: data, model, dan aturan skor dalam bahasa awam.
- Sumber data: daftar sumber, lisensi, kalimat atribusi wajib (termasuk atribusi BPS), dan tabel target resmi beserta tautannya. Situs tidak boleh terkesan sebagai situs resmi BPS atau lembaga lain.

### 4.2 Aturan skor segitiga

- **Lensa masa lalu (bawaan):** persentil dibanding tahun 2000-2025 dari data IMF WEO. Pertumbuhan makin tinggi makin baik, pengangguran makin rendah makin baik, dan harga stabil diukur dari jarak inflasi akhir tahun ke patokan 2,5%.
- **Lensa target:** skor 100 bila berada di zona target (pertumbuhan minimal target APBN; inflasi akhir tahun di dalam sasaran ± 1; TPT di bawah batas atas target APBN), turun 25 untuk setiap 1 poin persen di luar zona. Hanya tersedia untuk tahun yang target resminya lengkap.
- Pilihan lensa tersimpan di URL (`?lensa=target`).

### 4.3 Target resmi

- Target diambil dari UU APBN (pertumbuhan dan TPT), PMK sasaran inflasi, dan Perpres RPJMN. Angka yang masih bersumber pemberitaan dicocokkan ke teks resminya sebelum rilis publik.
- Nilainya tidak ditulis di dokumen ini. Daftar kurasinya (nilai, dokumen sumber, status verifikasi `dokumen` atau `berita`) ada di `config/targets.csv`.
- Diperiksa ulang setiap UU APBN baru disahkan (sekitar akhir September) dan setiap PMK sasaran inflasi baru terbit.

## 5. Bukan tujuan MVP

- Negara lain dan model panel lintas negara.
- Model skenario jangka panjang sendiri (World Bank LTGM).
- Dasbor fondasi struktural: tata kelola, korupsi, SDG, pendidikan.
- Sentimen berita (GDELT), data alternatif (kunjungan kapal, lampu malam), dan panel cek silang PDB.
- Ramalan kurs dan indeks saham.
- Akun pengguna, login, komentar, atau personalisasi.
- Iklan atau penggunaan komersial (paket Vercel Hobby untuk proyek non-komersial).
- Bahasa selain Indonesia.

## 6. Ukuran keberhasilan

| Ukuran | Target |
|---|---|
| Ketersediaan | Data ter-update otomatis tujuh hari berturut-turut tanpa campur tangan manual; selama uji itu, run sukses terakhir tidak pernah lebih dari 36 jam lalu |
| Kesegaran | Angka baru tampil paling lambat pagi setelah hari rilis BPS |
| Kejujuran label | Setiap angka punya sumber, tanggal, dan label "data resmi", "perkiraan Con-Fore", atau "proyeksi IMF" |
| Akurasi model | Galat (MAE) forecast Con-Fore dibandingkan dengan baseline per horizon dan diterbitkan di Rekam jejak. Angka utama adalah yang lebih akurat (model atau baseline); baseline dan proyeksi IMF selalu tampil sebagai pembanding, dan hasil yang kalah tetap dipublikasikan |
| Dipahami pembaca awam | Uji baca dengan lima orang awam: minimal empat bisa menjelaskan arti segitiga dan tiga kartu tanpa bantuan |
| Tampilan | Kedua tab tampil benar di HP dan desktop, tema terang dan gelap, dan segitiga punya teks alternatif untuk pembaca layar |
| Biaya | Rp0 untuk layanan (semua memakai paket gratis permanen); domain sendiri, bila dipilih, satu-satunya biaya |

## 7. Risiko produk

| Risiko | Mitigasi |
|---|---|
| Perkiraan dibaca sebagai janji | Rentang selalu tampil; label "perkiraan model, bukan angka resmi"; rekam jejak terbuka |
| Data resmi diperdebatkan publik (contoh: PDB kuartal II 2025) | Sumber dan revisi selalu tampil; panel cek silang di versi berikutnya |
| Target resmi berubah atau kedaluwarsa | Tabel target bersumber dengan tanggal pemeriksaan terakhir; dicek tiap akhir September |
| Sampel data pendek membuat model terlalu pas dengan masa lalu | Model sederhana, baseline wajib, backtest jujur |

Risiko teknis ada di [ARCHITECTURE.md](ARCHITECTURE.md#5-risiko-utama).

## 8. Tahapan

| Fase | Isi | Selesai bila |
|---|---|---|
| 0. Persiapan | Pengelola: isi kredensial Supabase, cek region proyek, daftar key BPS dan FRED, buat akun cron-job.org dan token GitHub khusus repo (izin Actions: write). Agent: kerangka repo, RUNBOOK, uji akses setiap sumber dari runner GitHub | Kredensial hanya ada di `.env`, GitHub Secrets, dan Vercel; key BPS terbukti jalan dari runner |
| 1. Data ke Supabase | Pengambil data tanpa key, migrasi skema dengan GRANT dan RLS, `config/targets.csv`, workflow harian | Satu perintah mengisi Supabase; dijalankan dua kali hasilnya sama; workflow jalan sesuai jadwal |
| 2. Tab Data (v0.1) | Next.js di Vercel: segitiga data resmi, tiga angka, penggerak, target resmi, sumber | Situs publik tampil benar di HP dan desktop |
| 3. Model | Baseline, DFM untuk PDB, model inflasi dan TPT, backtest | Setiap model dibandingkan dengan baseline dalam laporan backtest |
| 4. Tab Prediksi (v0.2) | Forecast dan rentang, penjelasan, jangka panjang, rekam jejak | Semua perkiraan berlabel dan bersumber |
| 5. Pengerasan (MVP) | Pemantauan, uji tujuh hari, halaman Cara kerja | Tujuh hari berturut-turut ter-update otomatis |

Keputusan produk dan alasannya dicatat di catatan proyek pengelola; dokumen ini hanya memuat hasilnya.

## 9. Pertanyaan terbuka

1. (Diputuskan 2026-10-30) Sebelum key BPS keluar, angka resmi diambil dari salinan IMF yang diberi label dan tertinggal beberapa minggu dari rilis BPS.
2. Domain: subdomain Vercel (gratis) atau domain sendiri (berbayar). Masih terbuka; sampai diputuskan, situs memakai subdomain bawaan Vercel.
3. (Terjawab 2026-10-30) Syarat data IMF (halaman Copyright and Usage, bagian "The Use of IMF Data") membolehkan data diunduh, diolah, dan disebarkan ulang dengan atribusi "International Monetary Fund, nama database, tautan dataset"; olahan yang mengubah data harus dinyatakan, dan penyedia unduhan wajib menyampaikan syarat ini ke penggunanya (berlaku untuk tombol unduh CSV di fase 2). Unduhan massal otomatis tetap butuh izin, jadi pipeline hanya menarik seri yang terdaftar, sekali sehari.
4. (Disetujui 2026-10-30) Tabel manual selain target resmi (`config/sources.csv`, `config/release_calendar.csv`, `config/holidays.csv`) menjadi pengecualian dari aturan "semua data dari API".
5. Perlu tidaknya panduan desain (`DESIGN.md`). Usulannya sudah ada di akar repo, ditulis dari tampilan tab Data v0.1, dan menunggu persetujuan pengelola.
