Status: plan. Rencana desain ulang dari nol, diputuskan pengelola lewat sesi drill 2026-11-20 sesudah dua uji baca gagal (fase 5c di PRD). Dokumen ini memuat susunan halaman dan aturan isi. Uji konsep lulus pada 2026-11-22, dan gaya visual (warna, huruf, bentuk, gerak) sedang dipilih dari tiga contoh gaya, jadi belum ditulis di sini. Situs yang tayang masih memakai susunan lama, dengan token di `web/app/globals.css`, sampai halaman baru dibangun.

# Panduan desain Con-Fore

Panduan susunan dan isi tampilan situs Con-Fore untuk desain ulang. Isi halaman per halaman ada di [PRD.md](PRD.md) bagian 4.1, dan dokumen ini menjelaskan aturan yang membentuknya.

## Arah

- Situs disusun dari empat pertanyaan orang awam, bukan dari nama indikator: harga naik berapa, susah cari kerja atau tidak, ekonomi tumbuh cepat atau lambat, dan ke depan bagaimana. Urutannya dari yang paling terasa sehari-hari.
- Kata didahulukan, gambar menyusul. Bahasa yang lebih sederhana dan contoh yang dekat dengan kehidupan sehari-hari lebih membantu pemahaman daripada gambar tambahan (lihat Referensi, Bank of England). Karena itu tidak ada skor, segitiga, atau gambar lain yang perlu dijelaskan dulu sebelum bisa dibaca.
- Susunan mengikuti pola situs atlas: peta dunia dulu, lalu profil negara. Con-Fore direncanakan mencakup seluruh dunia, dan Indonesia negara pertama.
- Setiap tahap diuji dulu dalam bentuk kasar hitam-putih, supaya yang dinilai kata dan susunannya, bukan warnanya.
- Yang dibawa dari desain lama karena terbukti dipahami di uji pertama: label "angka resmi" dan "perkiraan", rentang dalam kata, dan kotak penjelas. Contoh sehari-hari ikut dibawa karena didukung riset.

## Halaman depan dan globe

- Judul: "Penasaran bagaimana kondisi ekonomi tiap negara? Mari cari tahu". Judul ini yang memberi tahu topik situs di layar pertama.
- Globe 3D memperlihatkan semua negara. Negara yang tersedia menyala, dan negara lain abu-abu dengan tanda "belum tersedia". Globe belum membawa data per negara.
- **Di komputer:** globe berputar pelan dan berhenti saat kursor atau fokus keyboard ada di atasnya. Negara yang tersedia terangkat dari permukaan globe dan disorot saat kursor di atasnya, dan klik membuka halamannya.
- **Di HP:** globe diam menghadap Indonesia, yang sudah terangkat dan disorot sejak awal, dan sekali ketuk membuka halaman Indonesia. Alasannya, HP tidak punya kursor, dan negara di globe yang berputar sulit diketuk.
- **Di semua perangkat:** nama negara yang tersedia ditulis di atas globe sebagai tautan biasa, supaya bisa dibuka dengan keyboard dan pembaca layar. Globe tidak berputar bagi yang memilih kurangi animasi di perangkatnya.
- **Syarat aset globe:**
  1. bisa mengangkat dan menyorot satu negara saat kursor di atasnya,
  2. lisensinya membolehkan dipakai di situs publik,
  3. jalan di browser tanpa layanan luar atau kunci API,
  4. hanya dimuat di halaman depan, sesudah judul tampil,
  5. punya gambar diam pengganti bila perangkat tidak sanggup menampilkan 3D.
- Lisensi, ukuran, dan kode aset diperiksa sebelum dipakai.

## Halaman Indonesia

- Menjawab keempat pertanyaan dengan urutan di Arah. Tiga pertanyaan pertama memakai angka resmi terakhir, dan pertanyaan keempat memakai perkiraan ketiganya.
- Bentuknya ringkasan bercerita: satu paragraf pendek yang menjawab keempat pertanyaan dengan angka di dalam kalimat, lalu blok jawaban di bawahnya.
- Bentuk ini (C) dipilih di uji tahap pilih pada 2026-11-20 dari tiga calon, lalu dinyatakan lulus uji tahap lulus oleh pengelola pada 2026-11-22 (PRD 6). Dua calon lain tidak dipakai: satu halaman bergulir berisi empat blok jawaban (A), dan empat kartu pendek yang dibuka dengan diketuk (B).

## Komponen isi

- **Ringkasan bercerita:** satu paragraf di awal halaman Indonesia, berisi satu kalimat per pertanyaan dengan angkanya, berurutan seperti blok jawaban. Label di bawahnya menyebut kalimat mana yang angka resmi dan mana yang perkiraan.
- **Blok jawaban:** pertanyaan sebagai judul, jawaban satu kalimat, angka, contoh sehari-hari, perbandingan, label, dan waktu data. Urutannya sama di semua pertanyaan.
- **Perbandingan dalam kalimat:** dengan periode yang sama setahun sebelumnya, dengan rata-rata tahun 2000 sampai 2025, dan dengan target pemerintah tahun itu. Periode patokan selalu disebut (PRD 4.2).
- **Label:** "angka resmi BPS" atau "perkiraan Con-Fore, bukan angka resmi", selalu terlihat tanpa harus dibuka.
- **Rentang dalam kata:** "kemungkinan antara X dan Y", dengan arti "kemungkinan" dijelaskan sekali di dekatnya.
- **Waktu data:** periode data dan rilis berikutnya, ditulis di dekat angka.
- **Kotak penjelas:** lipatan yang dibuka dengan sengaja, berisi istilah resmi, cara membaca, dan sumber. Isi lipatan boleh lebih panjang dan teknis daripada lapisan pertama.
- **Baris empat pertanyaan:** Harga, Kerja, Ekonomi, dan Ke depan, di halaman Indonesia dan halaman rinci, untuk pindah topik.
- **Tautan pertanyaan berikutnya:** penutup setiap halaman rinci, berurutan dari Harga sampai Ke depan.
- **Grafik riwayat:** judulnya kalimat temuan dari templat netral (PRD 4.4). Grafik kipas hanya ada di halaman Ke depan.

## Bahasa

- Menyapa pembaca dengan "kamu". Kalimat pendek dan kata sehari-hari di lapisan pertama.
- Istilah resmi seperti inflasi tahunan (y-on-y), TPT, dan PDB riil hanya muncul di kotak penjelas.
- Format angka, narasi netral, dan contoh sehari-hari mengikuti PRD 4.4.
- Tulisan sekunder hanya untuk data, waktu, sumber, kunci membaca angka atau grafik, dan pemberitahuan wajib (bukan situs resmi, bukan nasihat keuangan). Kalimat yang mengulang judul, menjelaskan isi halaman, atau sekadar menunjuk ke halaman lain tidak dipakai. Isi kotak penjelas dan bagian penjelasan di Tentang data tidak termasuk aturan ini, karena dibuka pembaca dengan sengaja.

## Konsep kasar dan contoh gaya

- Konsep kasar hitam-putih untuk uji susunan tayang di `/konsep/` sejak 2026-11-20, berisi halaman depan dan halaman Indonesia bentuk A, B, dan C, lalu dihapus sesudah uji selesai pada 2026-11-22.
- Contoh gaya: halaman depan dan halaman Indonesia bentuk C dalam tiga gaya, di `/konsep/gaya-1.html`, `/konsep/gaya-2.html`, dan `/konsep/gaya-3.html`. Isi, angka, dan susunannya sama persis dengan konsep C, jadi yang dibandingkan hanya warna, huruf, dan bentuk.
- Keduanya HTML statis di `web/public/konsep/`, dengan angka asli per 20 November 2026 yang tanggalnya ditulis di halaman, dan peta dunia diam yang disederhanakan sampai aset globe tersedia.
- Contoh gaya memuat huruf dari Google Fonts karena berupa HTML statis. Halaman baru nanti memuat huruf lewat `next/font`, yang menyajikannya dari situs sendiri.
- Tidak masuk sitemap, ditandai `noindex`, dan dihapus sesudah gaya dipilih.

## Aksesibilitas

- HTML semantik (`header`, `nav`, `main`, `section` berjudul, `table` dengan `caption` dan `scope`), dan tautan "Langsung ke isi".
- Fokus keyboard selalu terlihat, dan tidak tertutup kepala yang menempel.
- Kontras teks minimal 4,5:1.
- Tidak ada geser horizontal halaman di lebar 320 px, dan tabel lebar digulir di wadahnya sendiri.
- Globe punya tautan teks, berhenti saat kursor atau fokus keyboard ada di atasnya, dan tidak berputar bagi yang memilih kurangi animasi. Bila uji aksesibilitas menilai itu belum cukup untuk gerak yang mulai sendiri, ditambah tombol henti.

## Belum diputuskan

- Gaya visual: warna, huruf, bentuk, dan gerak. Pengelola memilih satu dari tiga contoh gaya:
  - **Gaya 1, gelap ala Atlas:** biru malam, panel instrumen, judul Gelasio, isi Inter, dan angka JetBrains Mono, sama dengan token situs sekarang.
  - **Gaya 2, terang lugas:** tinta biru tua di latar terang, satu aksen biru, dan satu jenis huruf (Public Sans), dengan arah dari USAFacts.
  - **Gaya 3, terang ramah:** kartu putih membulat di latar abu muda, satu warna untuk setiap pertanyaan (Harga, Kerja, Ekonomi, dan Ke depan), dan huruf Plus Jakarta Sans buatan Tokotype dari Indonesia. Palet warna pertanyaannya lolos pemeriksa buta warna.
- Aset globe 3D, dicari pengelola dengan syarat di atas.
- Logo penuh. Sampai ada logo baru, tanda segitiga dan teks "Con-Fore" tetap dipakai.

## Referensi

- atlasgeopo.com (https://atlasgeopo.com/en): susunan peta dunia lalu profil negara, dan halaman pembanding negaranya (`/en/comparateur`) sebagai acuan halaman pembanding fase 7. Gayanya menjadi gaya 1 di contoh gaya. Logo, teks, ilustrasi, dan tata letak persisnya tidak disalin.
- USAFacts (https://usafacts.org/): waktu data di dekat angka, judul grafik berupa kalimat temuan, dan contoh hitung kecil untuk pembaca awam. Arah gaya 2 di contoh gaya juga diambil dari sini. Kata real-time-nya tidak diambil.
- New York Fed Staff Nowcast (https://www.newyorkfed.org/research/policy/nowcast): rentang yang ditulis dalam kalimat, grafik kipas, dan tabel batas.
- Ringkasan visual laporan inflasi Bank of England, yang diuji dalam eksperimen Bank of England dan Behavioural Insights Team (https://www.bankofengland.co.uk/working-paper/2018/enhancing-central-bank-communications-with-behavioural-insights): bahasa sederhana dan contoh yang dekat dengan kehidupan sehari-hari, sebagai acuan cara bertutur.

Sebelum keputusan desain baru (halaman atau layar baru, atau arah visual baru), buka daftar referensi desain yang disebut di aturan agent, kecuali proyek ini punya `.no-vault`, lalu catat referensi yang dipakai di sini. Baris ini tetap di sini.
