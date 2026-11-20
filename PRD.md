# PRD Con-Fore

> Status: disetujui pengelola 2026-10-30, dengan tambahan yang disetujui pengelola 2026-11-03, 2026-11-08, dan 2026-11-09. Pada 2026-11-20 pengelola memutuskan tampilan disusun ulang dari nol sesudah dua uji baca gagal, lewat sesi drill, dan hasilnya ditulis di bagian 2, 3, 4.1, 4.2, 4.4, 5, 6, 7, 8, dan 9. Situs yang tayang masih memakai susunan lama sampai halaman baru dibangun (fase 5c di bagian 8). Arti "lebih akurat" di bagian 6 diusulkan agent 2026-11-07 dan masih menunggu persetujuan pengelola. Menggantikan `docs/RENCANA-MVP.md`. Detail teknis ada di [ARCHITECTURE.md](ARCHITECTURE.md) dan [SCHEMA.md](SCHEMA.md), dan aturan tampilan di [DESIGN.md](DESIGN.md).

## 1. Masalah

Data ekonomi Indonesia tersebar di banyak lembaga (BPS, Bank Indonesia, IMF, OECD), terbit dengan jadwal yang berbeda-beda, dan disajikan untuk analis. Pembaca awam sulit menjawab pertanyaan sederhana: "Ekonomi kita sedang bagaimana, dan ke mana arahnya?" Con-Fore ingin menjawabnya dalam bahasa sehari-hari, dan menyajikan setiap perkiraan bersama rentang ketidakpastian dan catatan seberapa sering perkiraan itu meleset.

## 2. Pengguna

| Pengguna | Kebutuhan |
|---|---|
| **Utama:** orang dewasa Indonesia yang tidak bekerja atau kuliah di bidang ekonomi, keuangan, atau statistik, jarang membaca berita ekonomi, dan membuka situs dari HP | Jawaban sederhana untuk empat pertanyaan: harga naik berapa, susah cari kerja atau tidak, ekonomi tumbuh cepat atau lambat, dan ke depan bagaimana |
| **Kedua:** pembaca yang ingin menggali lebih dalam | Riwayat, penjelas, dan data olahan yang bisa diunduh, lengkap dengan sumber dan tanggal rilisnya |
| **Pengelola:** satu orang (pemilik repo) | Sistem yang berjalan sendiri setiap hari tanpa dirawat manual dan tanpa biaya |

## 3. Solusi singkat

Website publik berbahasa Indonesia yang online 24/7 dan diperbarui otomatis setiap hari.

- **Halaman depan** berupa globe yang memperlihatkan semua negara, karena Con-Fore direncanakan mencakup seluruh dunia. Untuk sekarang hanya Indonesia yang tersedia.
- **Halaman Indonesia** menjawab empat pertanyaan orang awam, masing-masing dengan satu kalimat, satu angka, dan satu contoh sehari-hari.
- **Halaman rinci** untuk setiap pertanyaan memuat riwayat, penjelas, dan perkiraannya.

Situs disusun dari pertanyaan, bukan dari nama indikator, dan tidak memakai skor atau gambar yang perlu dijelaskan dulu.

## 4. Ruang lingkup MVP

- **Negara:** Indonesia.
- **Target:** pertumbuhan PDB riil, inflasi IHK, dan tingkat pengangguran terbuka (TPT).
- **Horizon pendek:** nowcast kuartal berjalan dan forecast sampai akhir tahun depan untuk PDB dan inflasi, serta dua rilis TPT berikutnya.
- **Horizon panjang:** proyeksi IMF WEO sampai tahun terakhir yang tersedia (kini 2031), diberi label "proyeksi IMF", dibanding target jangka panjang pemerintah di halaman Ke depan.
- **Rilis bertahap:** v0.1 hanya tab Data, karena tidak butuh model, lalu v0.2 menambah tab Prediksi. Keduanya sudah tayang, dan kini diganti susunan di 4.1 lewat fase 5c.

### 4.1 Isi halaman

Prinsip yang berlaku di semua halaman:

1. Situs disusun dari empat pertanyaan orang awam, diurutkan dari yang paling terasa sehari-hari: harga naik berapa, susah cari kerja atau tidak, ekonomi tumbuh cepat atau lambat, dan ke depan bagaimana.
2. Setiap jawaban berisi satu kalimat, satu angka, dan satu contoh sehari-hari, lalu perbandingannya dalam kalimat (4.2).
3. Setiap angka membawa waktunya: periode data dan rilis berikutnya.
4. Label "angka resmi" atau "perkiraan" selalu terlihat. Perkiraan tidak pernah tampil tanpa rentang dalam kata dan catatan seberapa sering perkiraan itu meleset.
5. Penjelasan berlapis: kalimat pendek dan kata sehari-hari di lapisan pertama, istilah resmi di kotak penjelas, dan cara hitung di Tentang data.
6. Tampilan jelas independen dan netral (4.4).

**Halaman depan (`/`)**

- Judul: "Penasaran bagaimana kondisi ekonomi tiap negara? Mari cari tahu".
- Globe 3D berisi semua negara. Negara yang tersedia menyala, dan negara lain abu-abu dengan tanda "belum tersedia". Globe belum memuat data per negara.
- Di komputer, globe berputar pelan dan berhenti saat kursor ada di atasnya. Negara yang tersedia terangkat dan disorot saat kursor di atasnya, dan klik membuka halamannya.
- Di HP, globe diam menghadap Indonesia, yang sudah terangkat dan disorot, dan sekali ketuk membuka halamannya.
- Nama negara di globe adalah tautan, supaya bisa dibuka dengan keyboard dan pembaca layar. Globe tidak berputar bagi pengunjung yang mematikan animasi.

**Halaman Indonesia (`/indonesia`)**

- Menjawab keempat pertanyaan dengan urutan di prinsip 1. Tiga pertanyaan pertama memakai angka resmi terakhir, dan pertanyaan keempat memakai perkiraan Con-Fore untuk ketiganya.
- Bentuknya dipilih lewat uji konsep (6) dari tiga calon: satu halaman bergulir berisi empat blok, empat kartu yang dibuka dengan diketuk, atau satu paragraf ringkasan bercerita lalu blok rinci.

**Halaman rinci Harga, Kerja, dan Ekonomi (`/indonesia/harga`, `/indonesia/kerja`, `/indonesia/ekonomi`)**

Ketiganya memakai urutan isi yang sama:

1. jawaban satu kalimat, angka, dan contoh sehari-hari,
2. perbandingan dalam kalimat (4.2),
3. grafik riwayat dengan judul berupa kalimat temuan,
4. rincian khusus: kelompok harga (inti, harga diatur pemerintah, harga bergejolak) di Harga, dan porsi pekerja formal di Kerja,
5. yang ikut memengaruhi: harga minyak dunia, kurs rupiah, dan BI-Rate di Harga, serta harga batu bara, sawit, nikel, dan arah ekonomi Tiongkok di Ekonomi,
6. satu kalimat perkiraan, dengan tautan ke halaman Ke depan,
7. kotak penjelas, sumber, waktu data, dan tautan ke halaman data per seri.

**Halaman Ke depan (`/indonesia/ke-depan`)**

- Perkiraan ketiga angka, masing-masing satu kalimat dengan rentang dalam kata, dan grafik kipas untuk tiap angka.
- Seberapa sering meleset: rekam jejak yang menulis selisih dalam poin persen dan cakupan rentang sebagai hitungan, misalnya "3 dari 4 perkiraan jatuh di dalam rentangnya", dibanding angka resmi pertama. Persen tidak dipakai, karena persen dari sedikit perkiraan terlihat lebih pasti daripada kenyataannya.
- Pembanding proyeksi IMF dan target jangka panjang pemerintah (8% di RPJMN).
- Kotak penjelas cara menghitung, dengan tautan ke Tentang data.
- Perkiraan selalu berangkat dari angka resmi terakhir. Penjelasan "kenapa perkiraannya begini" hanya menyebut yang terbukti pada backtest. Bila tidak ada penggerak yang terbukti membantu, halamannya mengatakan itu, tidak mengarang penggerak.

**Halaman data per seri (`/indikator/[id]`)**

- Tetap ada sebagai halaman data dan unduhan untuk setiap seri: riwayat panjang, jadwal rilis, unduhan CSV, dan data terstruktur untuk mesin pencari. Ditautkan dari halaman rinci.
- Catatan revisi bila angka resmi yang tampil berubah (4.4).

**Tentang data (`/tentang-data`, nama baru halaman Metode)**

- Cara membaca label, jadwal pembaruan (4.4), data dan model, tabel hasil uji model dengan data lama, sumber, lisensi, kalimat atribusi wajib (termasuk atribusi BPS), dan tabel target resmi lengkap beserta tautannya.
- Situs tidak boleh terkesan sebagai situs resmi BPS atau lembaga lain.

**Menu dan alur**

- Menu atas hanya berisi logo (kembali ke globe), Indonesia, dan Tentang data.
- Halaman Indonesia dan halaman rinci memuat baris empat pertanyaan (Harga, Kerja, Ekonomi, Ke depan). Setiap halaman rinci ditutup tautan ke pertanyaan berikutnya, berurutan sampai Ke depan.
- Alamat lama dialihkan permanen: `/prediksi` ke `/indonesia/ke-depan`, dan `/metode`, `/cara-kerja`, serta `/sumber` ke `/tentang-data`.

**Banding**

- Halaman pembanding negara di fase 7 (bagian 8). Menunya baru muncul saat halaman itu tayang, supaya tidak ada menu yang berujung halaman kosong.

### 4.2 Perbandingan dalam kalimat

- Setiap angka resmi dibandingkan dalam kalimat dengan tiga patokan: periode yang sama setahun sebelumnya, rata-rata tahunan 2000 sampai 2025 dari seri IMF WEO, dan target pemerintah tahun itu.
- Periode patokannya selalu disebut, misalnya "lebih rendah dari rata-rata tahun 2000 sampai 2025".
- Target untuk seluruh tahun (pertumbuhan dan TPT dari UU APBN, sasaran inflasi akhir tahun dari PMK) ditulis sebagai patokan tahun itu, bukan seolah sudah tercapai atau gagal.
- Skor 0 sampai 100, pilihan lensa, status tiga tingkat, dan segitiga keseimbangan tidak dipakai lagi sejak keputusan pengelola 2026-11-20.

### 4.3 Target resmi

- Target diambil dari UU APBN (pertumbuhan dan TPT), PMK sasaran inflasi, dan Perpres RPJMN. Angka yang masih bersumber pemberitaan dicocokkan ke teks resminya sebelum rilis publik. Pencocokan selesai 2026-11-06, kecuali pertumbuhan dan TPT 2027, karena naskah UU APBN 2027 belum ditemukan di JDIH.
- Nilainya tidak ditulis di dokumen ini, kecuali target jangka panjang di 4.1. Daftar kurasinya (nilai, dokumen sumber, status verifikasi `dokumen` atau `berita`) ada di `config/targets.csv`.
- Diperiksa ulang setiap UU APBN baru disahkan (sekitar akhir September) dan setiap PMK sasaran inflasi baru terbit.

### 4.4 Aturan penyajian

- **Dua lapis.** Lapisan pertama memuat jawaban, angka, contoh sehari-hari, perbandingan, label, dan waktu data. Istilah resmi seperti inflasi tahunan (y-on-y), TPT, dan PDB riil hanya muncul di kotak penjelas. Rentang ramalan berupa grafik (fan chart) hanya ada di halaman Ke depan.
- **Nada.** Situs menyapa pembaca dengan "kamu", dengan kalimat pendek dan kata sehari-hari.
- **Pekerja formal dan informal.** Konteks pendamping TPT dari Sakernas BPS di halaman Kerja. TPT tetap angka utama. Kalimat otomatisnya hanya membandingkan ronde bulan yang sama (Februari dengan Februari), karena porsi pekerja formal berbeda menurut bulan survei. Yang dibandingkan adalah porsi terhadap seluruh pekerja, bukan jumlah orang, karena jumlah pekerja terus bertambah. Perubahan porsi di bawah 0,1 poin persen ditulis "hampir tidak berubah".
- **Rincian inflasi.** Inflasi umum y-on-y tetap angka utama. Halaman Harga memecahnya menjadi tiga kelompok BPS dengan nama netral: inti, harga diatur pemerintah, dan harga bergejolak. Setiap kelompok dijelaskan dari isinya (contoh barang dan jasa), bukan dari satu sebab tunggal seperti "cuaca" atau "BBM". BPS tidak menyediakan y-on-y per kelompok lewat API, jadi angkanya dirangkai dari 12 perubahan bulanan, berlabel "dihitung Con-Fore", dan ditulis satu desimal dengan kata "sekitar". Penyumbang terbesar bulan itu disebut bila datanya tersedia lewat API. Per 2026-11-06 data itu hanya ada di naskah rilis BPS, jadi belum ditampilkan.
- **Tanggal data, bukan "real-time".** Kurs, harga komoditas, dan suku bunga tampil pada periode terbaru yang sudah terbit, berlabel tanggal atau periode datanya. Situs tidak memakai kata "real-time", "langsung", atau "live", karena pipeline berjalan satu sampai dua kali sehari dan seri bulanan bisa tertinggal sekitar sebulan.
- **Narasi netral.** Kalimat tidak memberi vonis mutlak seperti "solid", "gagal", atau "hancur". Sebutan seperti "lebih tinggi" atau "lebih rendah" selalu disertai pembandingnya (4.2). Target 8% RPJMN hanya dibahas di halaman Ke depan.
- **Contoh sehari-hari ("artinya buatmu")** menjelaskan arti angka bagi rumah tangga. Tiga pertanyaan pertama dibuka dengan perumpamaan: satu keranjang belanja untuk inflasi, 100 orang untuk pengangguran, dan satu kue untuk pertumbuhan. Pertanyaan inflasi menambah satu kalimat yang mengikuti arah angkanya, misalnya "harga masih naik, tetapi lebih lambat dibanding bulan lalu". Isinya tidak pernah berupa saran belanja (5), dan tidak pernah meminta data pribadi seperti gaji. Contoh hitung memakai angka tetap dan hanya untuk dua angka: inflasi (keranjang belanja Rp100.000) dan pengangguran (100 orang yang bekerja atau mencari kerja). PDB, BI-Rate, dan angka lain tanpa contoh uang, karena PDB bukan pendapatan per orang dan BI-Rate tidak langsung menjadi bunga bank.
- **Format angka.** Koma desimal dan titik ribuan, dengan tanda persen menempel ("2,6%"). Selisih dua persentase ditulis "poin persen". Kalimat memakai kata biasa ("dibanding setahun sebelumnya"), label pendek memakai "tahunan", dan istilah "y-on-y" disebut sekali di penjelas supaya pembaca bisa mencocokkannya dengan berita.
- **Rentang dalam kata.** Kalimat utama perkiraan menulis rentang sebagai "kemungkinan antara X dan Y". Artinya dijelaskan sekali: pada uji dengan data lama, sekitar 8 dari 10 angka resmi di masa biasa jatuh di dalam rentang selebar itu. Istilah "rentang 80%" hanya dipakai di tabel.
- **Judul grafik berupa kalimat temuan.** Judul dibuat skrip dari templat yang hanya memakai kata naik, turun, atau tetap, dan diuji supaya kata yang menilai seperti "membaik" atau "memburuk" tidak muncul.
- **Jadwal pembaruan.** Ditulis sebagai rentang jam yang teramati dalam WIB, bukan jam jadwal, karena run terjadwal GitHub Actions biasanya mulai beberapa jam sesudah jadwalnya.
- **Catatan revisi.** Halaman data per seri mencatat revisi bila angka yang tampil berubah sesudah dibulatkan, lengkap dengan angka lama, angka baru, dan tanggal rilisnya. Revisi sebelum Con-Fore mulai menyimpan setiap versi data tidak terekam, dan halaman menyebut tanggal mulainya. Halaman Indonesia tidak memuat catatan revisi.

## 5. Bukan tujuan MVP

- Data dan model untuk negara lain. Globe di halaman depan menampilkan semua negara, tetapi hanya Indonesia yang tersedia. Sesudah MVP, fase 7 hanya menambah pembanding proyeksi IMF untuk empat negara tetangga, tanpa model Con-Fore untuk negara itu.
- Model skenario jangka panjang sendiri (World Bank LTGM).
- Dasbor fondasi struktural: tata kelola, korupsi, SDG, pendidikan.
- Sentimen berita (GDELT), data alternatif (kunjungan kapal, lampu malam), dan panel cek silang PDB.
- Ramalan kurs dan indeks saham.
- Nasihat keuangan, termasuk saran belanja atau investasi.
- Akun pengguna, login, komentar, atau personalisasi.
- Iklan atau penggunaan komersial (paket Vercel Hobby untuk proyek non-komersial).
- Bahasa selain Indonesia.

## 6. Ukuran keberhasilan

| Ukuran | Target |
|---|---|
| Ketersediaan | Data ter-update otomatis tujuh hari berturut-turut tanpa campur tangan manual, dan selama uji itu run sukses terakhir tidak pernah lebih dari 36 jam lalu. Lulus 2026-11-14, 7 dari 7 hari |
| Kesegaran | Angka baru tampil paling lambat pagi setelah hari rilis BPS |
| Kejujuran label | Setiap angka punya sumber, tanggal, dan label "angka resmi", "perkiraan Con-Fore", atau "proyeksi IMF" |
| Akurasi model | Galat (MAE) forecast Con-Fore dibandingkan dengan baseline per horizon dan diterbitkan di rekam jejak. Angka utama adalah yang lebih akurat (model atau baseline). Model dianggap lebih akurat hanya bila menang di masa normal dan di data sejak 2022. Baseline dan proyeksi IMF selalu tampil sebagai pembanding, dan hasil yang kalah tetap dipublikasikan |
| Dipahami pembaca awam | Uji konsep dua tahap. Tahap pilih: tiga orang melihat ketiga bentuk halaman Indonesia dengan urutan bergilir, dan bentuk yang paling dipahami dipilih. Tahap lulus: lima orang baru menguji bentuk terpilih. Seorang peserta lulus bila tanpa bantuan bisa menyebut topik situs dari halaman depan, menjawab keempat pertanyaan dengan kata-katanya sendiri beserta angkanya, dan membedakan angka resmi dari perkiraan. Uji lulus bila minimal empat dari lima orang lulus. Nilai tiap orang dicatat di lembar hasil, dan aturan ini dikunci sebelum uji pertama |
| Tampilan | Halaman depan, Indonesia, rinci, data per seri, dan Tentang data tampil benar di HP dan desktop. Globe punya tautan teks untuk keyboard dan pembaca layar, dan berhenti berputar bagi yang mematikan animasi |
| Biaya | Rp0 untuk layanan, karena semua memakai paket gratis permanen. Domain sendiri, bila dipilih, satu-satunya biaya |

## 7. Risiko produk

| Risiko | Mitigasi |
|---|---|
| Perkiraan dibaca sebagai janji | Rentang selalu tampil, label "perkiraan Con-Fore, bukan angka resmi", dan rekam jejak terbuka |
| Data resmi diperdebatkan publik (contoh: PDB kuartal II 2025) | Sumber dan revisi selalu tampil, dan panel cek silang di versi berikutnya |
| Target resmi berubah atau kedaluwarsa | Tabel target bersumber dengan tanggal pemeriksaan terakhir, dicek tiap akhir September |
| Sampel data pendek membuat model terlalu pas dengan masa lalu | Model sederhana, baseline wajib, dan backtest jujur. Variabel masuk model hanya bila menurunkan galat backtest dibanding baseline |
| Narasi dibaca sebagai sikap politik | Narasi netral dan contoh sehari-hari tanpa nasihat (4.4). Target 8% RPJMN hanya di halaman Ke depan |
| Globe 3D memperlambat halaman depan di HP | Globe dimuat sesudah judul tampil, ada gambar diam pengganti, dan di HP globe diam (`DESIGN.md`) |
| Desain baru kembali tidak dipahami | Konsep kasar diuji sebelum halaman dibangun, dan halaman baru baru dibangun dari bentuk yang lulus uji (6) |

Risiko teknis ada di [ARCHITECTURE.md](ARCHITECTURE.md#5-risiko-utama).

## 8. Tahapan

| Fase | Isi | Selesai bila |
|---|---|---|
| 0. Persiapan | Pengelola: isi kredensial Supabase, cek region proyek, daftar key BPS dan FRED, buat akun cron-job.org dan token GitHub khusus repo (izin Actions: write). Agent: kerangka repo, RUNBOOK, uji akses setiap sumber dari runner GitHub | Kredensial hanya ada di `.env`, GitHub Secrets, dan Vercel, dan key BPS terbukti jalan dari runner |
| 1. Data ke Supabase | Pengambil data tanpa key, migrasi skema dengan GRANT dan RLS, `config/targets.csv`, workflow harian | Satu perintah mengisi Supabase, dijalankan dua kali hasilnya sama, dan workflow jalan sesuai jadwal |
| 2. Tab Data (v0.1) | Next.js di Vercel: segitiga data resmi, tiga angka, penggerak, target resmi, sumber | Situs publik tampil benar di HP dan desktop |
| 3. Model | Baseline, DFM untuk PDB, model inflasi dan TPT, backtest | Setiap model dibandingkan dengan baseline dalam laporan backtest |
| 4. Tab Prediksi (v0.2) | Forecast dan rentang, penjelasan, jangka panjang, rekam jejak | Semua perkiraan berlabel dan bersumber |
| 5. Pengerasan (MVP) | Pemantauan, uji tujuh hari, halaman Cara kerja | Tujuh hari berturut-turut ter-update otomatis |
| 5b. Susunan baru | Dikerjakan 2026-11-09 dalam empat tahap di `web/`: menu dan halaman Metode, sampul segitiga dan waktu di kartu, halaman detail dan judul grafik, lalu perbaikan hasil uji baca pertama. Uji baca dengan lima orang sesudah tahap 3 dan uji ulang sesudah tahap 4 sama-sama belum lulus, jadi susunan ini diganti fase 5c. Bagian yang butuh pipeline atau tabel baru (tanggal rilis angka BPS dari kalender rilis, cakupan rentang di rekam jejak, dan catatan revisi) pindah ke fase 6 | Diganti fase 5c |
| 5c. Desain ulang | Dimulai 2026-11-20. (1) Konsep kasar hitam-putih: halaman depan dengan peta diam dan halaman Indonesia dalam tiga bentuk, di `/konsep/`, tidak diindeks mesin pencari, dan dihapus sesudah uji. (2) Uji tahap pilih dengan tiga orang. (3) Perbaikan bentuk terpilih, lalu uji tahap lulus dengan lima orang baru (6). (4) Pembangunan halaman baru di `web/` dengan alamat dan menu di 4.1, termasuk globe 3D dari aset yang memenuhi syarat di `DESIGN.md`. (5) Gaya visual dipilih sesudah uji lulus, dengan gaya gelap Atlas sebagai salah satu calon. Setiap tahap langsung tayang sesudah lulus tes dan build | Uji tahap lulus lulus, halaman baru tampil benar di HP dan desktop, dan lolos daftar periksa tampilan pengelola serta linter Design Kit |
| 6. Otomasi perawatan | Uji tujuh hari lulus 2026-11-14, jadi fase ini boleh jalan berdampingan dengan fase 5c selama hanya menyentuh pipeline. Pengingat lewat issue GitHub untuk tabel tahunan (target resmi, kalender rilis, tanggal Lebaran) dan satu workflow pemeriksa untuk cek bulanan, tanpa panggilan model AI, ditambah bagian pipeline dari fase 5b. Angka resmi dari dokumen tetap disetujui pengelola, dan agent hanya dipakai untuk mengubah kode dan menulis teks penjelas. Tampilan untuk data barunya dibuat di halaman fase 5c | Cek bulanan di RUNBOOK yang bisa dijalankan script tidak lagi manual, dan setiap pengingat terbukti membuka issue saat diuji |
| 7. Pembanding negara | Dimulai sesudah fase 5c dan 6. Satu halaman yang menampilkan proyeksi IMF untuk Indonesia dan satu negara pilihan pengunjung (Malaysia, Thailand, Filipina, atau Vietnam) berdampingan: pertumbuhan, inflasi akhir tahun, dan pengangguran sampai tahun terakhir proyeksi IMF. Perkiraan Con-Fore untuk Indonesia tampil sebagai baris berlabel pada tahun yang juga diramal Con-Fore. Tanpa rentang, karena IMF tidak menerbitkannya. Model Con-Fore untuk negara lain tidak termasuk | Keempat pasangan tampil benar di HP dan desktop, setiap angka berlabel proyeksi IMF dengan sumber dan tanggal terbitnya, dan perbedaan definisi pengangguran antarnegara tertulis di halaman |

Keputusan produk dan alasannya dicatat di catatan proyek pengelola, dan dokumen ini hanya memuat hasilnya.

## 9. Pertanyaan terbuka

1. (Diputuskan 2026-10-30) Sebelum key BPS keluar, angka resmi diambil dari salinan IMF yang diberi label dan tertinggal beberapa minggu dari rilis BPS.
2. Domain: subdomain Vercel (gratis) atau domain sendiri (berbayar). Masih terbuka, dan sampai diputuskan situs memakai subdomain bawaan Vercel.
3. (Terjawab 2026-10-30) Syarat data IMF (halaman Copyright and Usage, bagian "The Use of IMF Data") membolehkan data diunduh, diolah, dan disebarkan ulang dengan atribusi "International Monetary Fund, nama database, tautan dataset". Olahan yang mengubah data harus dinyatakan, dan penyedia unduhan wajib menyampaikan syarat ini ke penggunanya (berlaku untuk tombol unduh CSV). Unduhan massal otomatis tetap butuh izin, jadi pipeline hanya menarik seri yang terdaftar, sekali sehari.
4. (Disetujui 2026-10-30) Tabel manual selain target resmi (`config/sources.csv`, `config/release_calendar.csv`, `config/holidays.csv`) menjadi pengecualian dari aturan "semua data dari API".
5. (Disetujui 2026-10-31, diganti 2026-11-20) Panduan desain ada di `DESIGN.md`. Sejak 2026-11-20 isinya versi rencana untuk desain ulang, tanpa gaya visual.
6. (Gugur 2026-11-20) Ambang status tiga tingkat tidak dipakai lagi, karena status itu dibuang bersama skor.
7. Aset globe 3D di halaman depan dicari pengelola. Syaratnya ada di `DESIGN.md`.
8. Gaya visual (warna, huruf, bentuk, gerak) dipilih sesudah uji konsep lulus, dengan gaya gelap Atlas sebagai salah satu calon.
