Status: berlaku sejak 2026-11-22, sesuai kode di `web/`. Desain ulang dari nol (fase 5c di PRD), diputuskan pengelola lewat drill 2026-11-20 sesudah dua uji baca gagal, lalu lewat uji konsep sampai 2026-11-22: halaman Indonesia bentuk C dan gaya visual 3. Tokennya di `web/app/globals.css`. Globe di halaman depan digambar di kanvas dengan d3-geo sejak 2026-11-22, dan peta diam menjadi gambar penggantinya.

# Panduan desain Con-Fore

Panduan susunan, isi, dan gaya tampilan situs Con-Fore. Isi halaman per halaman ada di [PRD.md](PRD.md) bagian 4.1, dan dokumen ini menjelaskan aturan yang membentuknya.

## Arah

- Situs disusun dari empat pertanyaan orang awam, bukan dari nama indikator: harga naik berapa, susah cari kerja atau tidak, ekonomi tumbuh cepat atau lambat, dan ke depan bagaimana. Urutannya dari yang paling terasa sehari-hari.
- Kata didahulukan, gambar menyusul. Bahasa yang lebih sederhana dan contoh yang dekat dengan kehidupan sehari-hari lebih membantu pemahaman daripada gambar tambahan (lihat Referensi, Bank of England). Karena itu tidak ada skor, segitiga, atau gambar lain yang perlu dijelaskan dulu sebelum bisa dibaca.
- Susunan mengikuti pola situs atlas: peta dunia dulu, lalu profil negara. Con-Fore direncanakan mencakup seluruh dunia, dan Indonesia negara pertama.
- Setiap tahap diuji dulu dalam bentuk kasar hitam-putih, supaya yang dinilai kata dan susunannya, bukan warnanya.
- Yang dibawa dari desain lama karena terbukti dipahami di uji pertama: label "angka resmi" dan "perkiraan", rentang dalam kata, dan kotak penjelas. Contoh sehari-hari ikut dibawa karena didukung riset.

## Halaman depan dan globe

- Judul: "Penasaran bagaimana kondisi ekonomi tiap negara? Mari cari tahu". Judul ini yang memberi tahu topik situs di layar pertama.
- Globe memperlihatkan semua negara. Negara yang tersedia menyala, dan negara lain abu-abu, dengan legenda "Tersedia" dan "Belum tersedia" di bawah globe. Globe belum membawa data per negara.
- **Di komputer:** globe berputar pelan dan berhenti saat kursor ada di atas bola. Negara yang tersedia terangkat dari permukaan globe dan disorot saat kursor di atasnya, dan klik membuka halamannya. Saat tautan nama negara disorot kursor atau fokus keyboard, globe berhenti, berputar menghadap negara itu, dan negaranya terangkat. Tombol "Hentikan putaran" di bawah globe menghentikan putaran sampai ditekan lagi.
- **Di HP:** globe diam menghadap Indonesia, yang sudah terangkat dan disorot sejak awal, dan sekali ketuk membuka halaman Indonesia. Alasannya, HP tidak punya kursor, dan negara di globe yang berputar sulit diketuk. Komputer dan HP dibedakan dari ada tidaknya kursor (media query `hover: hover` dan `pointer: fine`), bukan dari lebar layar.
- **Di semua perangkat:** nama negara yang tersedia ditulis di atas globe sebagai tautan biasa, supaya bisa dibuka dengan keyboard dan pembaca layar. Kanvas globe disembunyikan dari pembaca layar. Bagi yang memilih kurangi animasi di perangkatnya, globe diam menghadap Indonesia dan tombol henti tidak ditampilkan.
- **Aset globe:** globe digambar sendiri di kanvas dengan proyeksi ortografis d3-geo, dari batas negara Natural Earth skala 1:110m lewat paket world-atlas dan topojson-client (`web/lib/gambar-globe.ts` dan `web/lib/globe.ts`). Pengelola memilihnya 2026-11-22. Kelima syarat aset terpenuhi:
  1. bisa mengangkat dan menyorot satu negara saat kursor di atasnya: Indonesia digambar paling akhir, terangkat dengan bayangan,
  2. lisensinya membolehkan dipakai di situs publik: d3-geo dan topojson-client berlisensi ISC, dan Natural Earth domain publik,
  3. jalan di browser tanpa layanan luar atau kunci API: data petanya ikut di kode situs,
  4. hanya dimuat di halaman depan, sesudah judul tampil: kode dan data peta diunduh sesudah halaman tampil, dan bola kosong tampil lebih dulu,
  5. punya gambar diam pengganti: peta dunia diam di poin berikut.
- **Gambar diam pengganti:** peta dunia diam yang disederhanakan (`web/lib/peta.ts`), dengan Indonesia menyala dan terangkat saat kursor di atasnya, dan nama Indonesia sebagai tautan. Peta ini tampil bila JavaScript mati atau kanvas gagal digambar.
- Lisensi, ukuran, dan kode paketnya diperiksa 2026-11-22 sebelum dipakai. Kode dan data globe sekitar 50 KB gzip. Calon lain, globe.gl, tidak dipakai karena ukurannya sekitar 559 KB gzip.

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

## Gaya visual

Gaya 3, terang dan ramah, dipilih pengelola 2026-11-22 dari tiga contoh gaya: gelap ala Atlas, terang lugas, dan terang ramah.

- **Warna dasar:** latar abu muda `#f4f5f7`, kartu putih `#ffffff`, tinta `#1c2333`, teks sekunder `#4b5563` dan `#5f6b7a`, dan garis `#e3e6eb`. Semua warna teks minimal 4,5:1 terhadap latarnya.
- **Warna pertanyaan:** Harga `#b93815`, Kerja `#1d5fb8`, Ekonomi `#0b7a5c`, dan Ke depan `#586174`, yang netral karena isinya perkiraan. Ketiga warna pertama lolos pemeriksa palet buta warna. Warnanya hanya untuk penanda: garis pendek di atas judul blok, titik di baris empat pertanyaan, angka besar, angka di ringkasan bercerita, latar contoh sehari-hari, dan garis grafik. Teks biasa tetap bertinta. Warna selalu berpasangan dengan nama pertanyaannya, jadi tidak pernah menjadi satu-satunya penanda.
- **Huruf:** satu jenis, Plus Jakarta Sans buatan Tokotype dari Indonesia, disajikan dari situs sendiri lewat `next/font`. Teks bacaan 17 px dengan spasi kata ditambah 0,05em, judul halaman 34 px di HP dan 42 px di layar lebar, judul blok 21 px, dan angka besar 48 px dengan angka tabular. Ketebalannya 400 untuk isi, 600 untuk label dan tautan, dan 700 untuk judul dan angka.
- **Bentuk:** kartu putih tanpa garis tepi dan tanpa bayangan di latar abu, dengan sudut 20 px untuk blok dan panel, 16 px untuk kartu, 14 px untuk lipatan dan contoh, dan 8 px untuk label. Label angka resmi bergaris utuh, dan label perkiraan bergaris putus-putus. Lipatan memakai latar tipis dan tanda panah di kanan.
- **Tata letak:** halaman Indonesia berupa satu kolom baca selebar sekitar 44rem, dan halaman rinci sekitar 56rem. Halaman Ke depan, Tentang data, dan data per seri memakai lebar penuh untuk kartu, tabel, dan daftar isi. Di halaman depan, globe selebar paling banyak 34rem di tengah kolom, dan legenda serta tombol henti selebar globe tepat di bawahnya.
- **Grafik:** garis 2,25 px dengan warna pertanyaan halamannya, perkiraan putus-putus, pita rentang berwarna sama dengan kepekatan 16%, dan kisi abu tipis. Di HP, label grafik lebar dibesarkan supaya tetap terbaca.
- **Gerak:** satu-satunya gerak yang mulai sendiri adalah putaran globe di komputer, 4 derajat per detik atau satu putaran dalam 90 detik. Selebihnya hanya umpan balik: Indonesia di globe terangkat 3 px dengan bayangan dalam 150 ms saat kursor di atasnya, globe berputar menghadap Indonesia dalam 400 ms saat tautan namanya disorot dan putaran itu bisa disela, kanvas globe muncul memudar dalam 200 ms, Indonesia di peta diam terangkat 1,5 px, dan tautan berganti warna halus dalam 150 ms. Bagi yang memilih kurangi animasi, globe tidak berputar dan Indonesia di globe terangkat seketika tanpa animasi. Angkatan di peta diam dan semua transisi dimatikan.

## Aksesibilitas

- HTML semantik (`header`, `nav`, `main`, `section` berjudul, `table` dengan `caption` dan `scope`), dan tautan "Langsung ke isi".
- Fokus keyboard selalu terlihat, dan tidak tertutup kepala yang menempel.
- Kontras teks minimal 4,5:1.
- Tidak ada geser horizontal halaman di lebar 320 px, dan tabel lebar digulir di wadahnya sendiri.
- Globe punya tautan teks di atasnya, dan kanvasnya disembunyikan dari pembaca layar. Globe berhenti saat kursor ada di atas bola atau saat tautan namanya disorot kursor atau fokus keyboard, dan tidak berputar bagi yang memilih kurangi animasi. Karena putarannya mulai sendiri dan berlangsung lebih dari lima detik, ada tombol "Hentikan putaran" (WCAG 2.2.2). Di mode warna paksa, tombol henti diberi garis tepi, dan kotak legenda tetap berwarna asli seperti kanvas globe.

## Belum diputuskan

- Logo penuh. Sampai ada logo baru, tanda segitiga dan teks "Con-Fore" tetap dipakai.

## Riwayat uji

- Konsep kasar hitam-putih (halaman depan dan halaman Indonesia bentuk A, B, dan C) tayang di `/konsep/` 2026-11-20 sampai 2026-11-22. Bentuk C dipilih di tahap pilih dan dinyatakan lulus tahap lulus oleh pengelola (PRD 6).
- Tiga contoh gaya tayang di `/konsep/` pada 2026-11-22, dan gaya 3 dipilih.
- Keduanya sudah dihapus dari situs, dan isinya ada di riwayat git.

## Referensi

- atlasgeopo.com (https://atlasgeopo.com/en): susunan peta dunia lalu profil negara, dan halaman pembanding negaranya (`/en/comparateur`) sebagai acuan halaman pembanding fase 7. Gaya gelapnya menjadi gaya 1 di contoh gaya dan tidak dipilih. Logo, teks, ilustrasi, dan tata letak persisnya tidak disalin.
- USAFacts (https://usafacts.org/): waktu data di dekat angka, judul grafik berupa kalimat temuan, dan contoh hitung kecil untuk pembaca awam. Kata real-time-nya tidak diambil.
- New York Fed Staff Nowcast (https://www.newyorkfed.org/research/policy/nowcast): rentang yang ditulis dalam kalimat, grafik kipas, dan tabel batas.
- Ringkasan visual laporan inflasi Bank of England, yang diuji dalam eksperimen Bank of England dan Behavioural Insights Team (https://www.bankofengland.co.uk/working-paper/2018/enhancing-central-bank-communications-with-behavioural-insights): bahasa sederhana dan contoh yang dekat dengan kehidupan sehari-hari, sebagai acuan cara bertutur.
- Plus Jakarta Sans (https://fonts.google.com/specimen/Plus+Jakarta+Sans): huruf gaya 3, buatan Tokotype.
- d3-geo (https://d3js.org/d3-geo): proyeksi ortografis untuk globe kanvas di halaman depan.
- Natural Earth (https://www.naturalearthdata.com/), lewat world-atlas (https://github.com/topojson/world-atlas): batas negara skala 1:110m untuk globe, domain publik.
- Emil Kowalski (https://emilkowal.ski/) dan Laws of UX karya Jon Yablonski (https://lawsofux.com/): umpan balik gerak yang singkat, ease-out untuk yang masuk layar, gerak panjang yang bisa disela, dan legenda serta tombol yang diletakkan dekat globe.

Sebelum keputusan desain baru (halaman atau layar baru, atau arah visual baru), buka daftar referensi desain yang disebut di aturan agent, kecuali proyek ini punya `.no-vault`, lalu catat referensi yang dipakai di sini. Baris ini tetap di sini.
