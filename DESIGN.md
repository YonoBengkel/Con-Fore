Status: berlaku sejak 2026-11-22, sesuai kode di `web/`. Desain ulang dari nol (fase 5c di PRD), diputuskan pengelola lewat drill 2026-11-20 sesudah dua uji baca gagal, lalu lewat uji konsep sampai 2026-11-22: halaman Indonesia bentuk C dan gaya visual 3. Tokennya di `web/app/globals.css`. Globe di halaman depan digambar di kanvas dengan d3-geo sejak 2026-11-22, dan peta diam menjadi gambar penggantinya. Huruf yang lebih kecil, tata letak selebar layar di komputer, teks rata kiri kanan, dan globe yang bisa diseret berlaku sejak 2026-11-24, dari catatan pengelola sesudah melihat situs di HP dan komputer. Halaman Banding dan menunya menyusul di hari yang sama.

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
- Globe memperlihatkan semua negara. Negara yang tersedia menyala, dan negara lain abu-abu, dengan legenda "Tersedia" dan "Belum tersedia". Di HP semuanya bertumpuk dengan legenda di bawah globe. Di layar lebar judul, nama negara, dan legenda ada di kiri, dan globe setinggi layar di kanan. Globe belum membawa data per negara.
- **Di komputer:** globe berputar pelan dan berhenti selama kursor ada di atas bola. Negara yang tersedia terangkat dari permukaan globe dan disorot saat kursor di atasnya, dan klik membuka halamannya. Saat tautan nama negara disorot kursor atau fokus keyboard, globe berhenti, berputar menghadap negara itu, dan negaranya terangkat. Klik dengan Ctrl, Cmd, atau Shift, atau klik tengah, membuka halaman negaranya di tab baru, seperti tautan biasa.
- **Menyeret globe:** bola bisa diseret dengan kursor ke segala arah, dan permukaannya ikut ke arah kursor. Kursornya tangan terbuka di atas bola dan menggenggam selama menyeret. Bila dilepas selagi bergerak, globe melaju terus ke arah itu lalu melambat sampai diam, dan menekannya lagi menangkapnya. Penekanan yang menangkapnya tidak membuka halaman negara, kecuali negaranya sedang disorot kursor. Putaran otomatis berikutnya mengikuti arah seretan terakhir. Kemiringannya paling jauh 70 derajat, jadi utara selalu di atas. Geseran sampai 5 px masih dihitung klik, dan seretan tidak pernah membuka halaman negara.
- **Menghentikan putaran:** globe tidak punya tombol henti, pilihan pengelola 2026-11-24. Klik pada bola di luar negara yang tersedia menghentikan putaran, dan klik berikutnya atau seretan menjalankannya lagi. Fokus keyboard di tautan nama negara juga menghentikannya, karena pengguna keyboard tidak bisa mengeklik bola. Globe yang dihentikan tetap berhenti selama halamannya terbuka, juga sesudah dipasang ulang karena preferensi perangkat berubah.
- **Di HP:** globe diam menghadap Indonesia, yang sudah terangkat dan disorot sejak awal, dan sekali ketuk membuka halaman Indonesia. Alasannya, HP tidak punya kursor, dan negara di globe yang berputar sulit diketuk. Usapan jari yang dimulai mendatar memutar globe searah jari, dan usapan yang dimulai tegak tetap menggulir halaman. Sesudah dilepas globe melambat sampai diam dan tidak berputar sendiri. Ketukan pada bola di luar negara yang tersedia menghadapkan titik itu ke tengah, jadi sisi lain globe bisa dilihat tanpa menyeret. Ketukan yang menangkap globe yang masih melaju hanya menghentikannya. Komputer dan HP dibedakan dari ada tidaknya kursor (media query `hover: hover` dan `pointer: fine`), bukan dari lebar layar.
- **Di semua perangkat:** nama negara yang tersedia ditulis di dekat globe sebagai tautan biasa, supaya bisa dibuka dengan keyboard dan pembaca layar. Kanvas globe disembunyikan dari pembaca layar. Bagi yang memilih kurangi animasi di perangkatnya, globe diam menghadap Indonesia, tetap bisa diseret tanpa lemparan, dan klik pada bola langsung menghadapkan titik itu. Pilihan kurangi animasi dan ada tidaknya kursor dibaca ulang saat berubah, jadi langsung berlaku tanpa memuat ulang halaman.
- **Aset globe:** globe digambar sendiri di kanvas dengan proyeksi ortografis yang sama dengan d3-geo, dari batas negara Natural Earth skala 1:110m lewat paket world-atlas dan topojson-client (`web/lib/gambar-globe.ts` dan `web/lib/globe.ts`). Pengelola memilihnya 2026-11-22. Kelima syarat aset terpenuhi:
  1. bisa mengangkat dan menyorot satu negara saat kursor di atasnya: Indonesia digambar paling akhir, terangkat dengan bayangan,
  2. lisensinya membolehkan dipakai di situs publik: d3-geo dan topojson-client berlisensi ISC, dan Natural Earth domain publik,
  3. jalan di browser tanpa layanan luar atau kunci API: data petanya ikut di kode situs,
  4. hanya dimuat di halaman depan, sesudah judul tampil: kode dan data peta diunduh sesudah halaman tampil, dan bola kosong tampil lebih dulu,
  5. punya gambar diam pengganti: peta dunia diam di poin berikut.
- **Gambar diam pengganti:** peta dunia diam yang disederhanakan (`web/lib/peta.ts`), dengan Indonesia menyala dan terangkat saat kursor di atasnya, dan nama Indonesia sebagai tautan. Peta ini tampil bila JavaScript mati atau kanvas gagal digambar. Bila kanvas gagal, tautan nama Indonesia di dekat globe tetap ada, jadi peta tampil tanpa nama keduanya. Gaya tampilan tanpa JavaScript ditulis di dalam `noscript`, jadi berlaku juga di browser lama yang belum mengenal `@media (scripting: none)`.
- Lisensi, ukuran, dan kode paketnya diperiksa 2026-11-22 sebelum dipakai. Kode dan data globe sekitar 50 KB gzip. Calon lain, globe.gl, tidak dipakai karena ukurannya sekitar 559 KB gzip.

## Halaman Indonesia

- Menjawab keempat pertanyaan dengan urutan di Arah. Tiga pertanyaan pertama memakai angka resmi terakhir, dan pertanyaan keempat memakai perkiraan ketiganya.
- Bentuknya ringkasan bercerita: satu paragraf pendek yang menjawab keempat pertanyaan dengan angka di dalam kalimat, lalu blok jawaban di bawahnya.
- Bentuk ini (C) dipilih di uji tahap pilih pada 2026-11-20 dari tiga calon, lalu dinyatakan lulus uji tahap lulus oleh pengelola pada 2026-11-22 (PRD 6). Dua calon lain tidak dipakai: satu halaman bergulir berisi empat blok jawaban (A), dan empat kartu pendek yang dibuka dengan diketuk (B).

## Halaman Banding

- Judulnya "Indonesia dan" nama negara, dengan tanggal terbit proyeksi IMF di bawahnya. Pilihan empat negara ditaruh sebelum angkanya, dan setiap pilihan adalah tautan ke alamatnya sendiri.
- Tiga kartu, Harga, Kerja, dan Ekonomi, dengan isi berurutan: judul, nama angkanya, kalimat, grafik, label, tabel, lalu sumber dan catatan.
- Tabel mengikuti grafik dan labelnya: di bawahnya, atau di kanannya di lebar 720 sampai 959 px. Contoh garis di kepala tabelnya menjadi legenda grafik, jadi tidak ada kotak legenda terpisah.
- Baris perkiraan Con-Fore menyatu dengan tahun di atasnya, tanpa garis pemisah, dengan label kecil "Perkiraan Con-Fore" yang bergaris putus-putus. Keterangan di bawah tabel menulis bahwa itu bukan angka resmi.
- Label tanggal terbit berlaku untuk kedua negara. Selama salah satunya gagal diambil dan masih edisi lama, label menulis kedua tanggal, dan waktu di bawah judul halaman hanya tampil bila ketiga kartu sama.
- Semua angka di halaman ini satu desimal, supaya kedua negara ditulis sama teliti.

## Komponen isi

- **Ringkasan bercerita:** satu paragraf di awal halaman Indonesia, berisi satu kalimat per pertanyaan dengan angkanya, berurutan seperti blok jawaban. Label di bawahnya menyebut kalimat mana yang angka resmi dan mana yang perkiraan.
- **Blok jawaban:** pertanyaan sebagai judul, jawaban satu kalimat, angka, contoh sehari-hari, perbandingan, label, dan waktu data. Urutannya sama di semua pertanyaan.
- **Perbandingan dalam kalimat:** dengan periode yang sama setahun sebelumnya, dengan rata-rata tahun 2000 sampai 2025, dan dengan target pemerintah tahun itu. Periode patokan selalu disebut (PRD 4.2).
- **Label:** "angka resmi BPS", "perkiraan Con-Fore, bukan angka resmi", atau "Proyeksi IMF" dengan tanggal terbitnya, selalu terlihat tanpa harus dibuka.
- **Rentang dalam kata:** "kemungkinan antara X dan Y", dengan arti "kemungkinan" dijelaskan sekali di dekatnya. Halaman Banding tanpa rentang, dan menautkannya ke Ke depan (PRD 4.1).
- **Waktu data:** periode data dan rilis berikutnya, ditulis di dekat angka.
- **Kotak penjelas:** lipatan yang dibuka dengan sengaja, berisi istilah resmi, cara membaca, dan sumber. Isi lipatan boleh lebih panjang dan teknis daripada lapisan pertama.
- **Baris empat pertanyaan:** Harga, Kerja, Ekonomi, dan Ke depan, di halaman Indonesia dan halaman rinci, untuk pindah topik.
- **Pilihan negara:** empat tautan di halaman Banding, dengan bentuk yang sama dengan baris empat pertanyaan tetapi tanpa titik warna, karena warna hanya milik pertanyaan. Di HP keempatnya sebaris, atau dua baris bila layarnya lebih sempit dari 360 px atau hurufnya diperbesar.
- **Tautan pertanyaan berikutnya:** penutup setiap halaman rinci, berurutan dari Harga sampai Ke depan. Ke depan ditutup tautan ke Banding, dan Banding ditutup tautan ke Ke depan.
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
- **Huruf:** satu jenis, Plus Jakarta Sans buatan Tokotype dari Indonesia, disajikan dari situs sendiri lewat `next/font`. Skalanya 13, 14, 15, 17, 20, 28, dan 36 px di HP: label dan keterangan 13, teks sekunder dan tabel 14, teks bacaan 15 dengan spasi kata ditambah 0,05em, judul blok 17, judul bagian 20, judul halaman 28, dan angka besar 36 dengan angka tabular. Mulai lebar 720 px, ringkasan bercerita naik ke 16, judul bagian ke 22, judul halaman ke 34, dan angka besar ke 40. Ukuran sebelumnya (teks bacaan 17, judul halaman 34 dan 42, angka besar 48) masih terlalu besar menurut pengelola. Ketebalannya 400 untuk isi, 600 untuk label dan tautan, dan 700 untuk judul dan angka.
- **Rata kiri kanan:** paragraf dan poin rata kiri kanan, pilihan pengelola 2026-11-24. Yang tetap rata kiri: judul, tabel, label, tombol, tautan, waktu dan jadwal data beserta catatannya, sitasi sumber, jawaban satu kalimat di atas angka besar, dan kalimat perkiraan, karena barisnya sedikit dan celah antarkatanya akan renggang. Begitu juga kolom yang sempit, yang kebanyakan lebih sempit daripada layar HP: blok jawaban dan kartu yang ikut memengaruhi di lebar 720 sampai 959 px, kartu perkiraan dan panel angka terakhir di lebar 960 sampai 1199 px, kartu Banding di lebar 720 sampai 1199 px, catatan pendek di kartu Banding di semua lebar, ringkasan halaman Indonesia di lebar 1200 sampai 1399 px, dan kartu yang ikut memengaruhi mulai lebar 1200 px. Kata tidak dipenggal, karena Chrome dan Edge tidak punya kamus pemenggal bahasa Indonesia, dan tanda hubung lunak membuat pembaca layar NVDA memotong katanya. Akibatnya celah antarkata di HP lebih longgar daripada di komputer.
- **Bentuk:** kartu putih tanpa garis tepi dan tanpa bayangan di latar abu, dengan sudut 20 px untuk blok dan panel, 16 px untuk kartu, 14 px untuk lipatan dan contoh, dan 8 px untuk label. Label angka resmi bergaris utuh, dan label perkiraan serta proyeksi IMF bergaris putus-putus. Lipatan memakai latar tipis dan tanda panah di kanan.
- **Tata letak:** isi selebar layar sampai 120rem. Di HP semuanya bertumpuk menurut urutan baca. Mulai lebar 720 px blok jawaban, kartu yang ikut memengaruhi, dan keterangan data per seri dua kolom. Mulai 960 px boks yang lain berdampingan, dan mulai 1200 px ringkasan halaman Indonesia pindah ke samping blok jawaban. Urutan di HTML mengikuti urutan baca di HP. Di layar lebar tiga bagian tampil di tempat lain tanpa mengubah urutan itu: baris empat pertanyaan di kanan judulnya, angka terakhir data per seri di kanan grafiknya, dan legenda di kiri globe. Di HP tulisan menu 13 px dan merek 15 px dengan jarak yang dirapatkan, supaya merek dan ketiga tautan menu sebaris mulai lebar 360 px. Mulai 30em ukurannya kembali 14 dan 17 px.
  - Halaman Indonesia: ringkasan di kiri dan tetap terlihat selama digulir (kecuali layarnya pendek atau ada pemberitahuan data terlambat), dan empat blok jawaban dua kolom di kanan, dengan tautan rinciannya sejajar di dasar blok.
  - Halaman rinci: jawaban di kiri dan grafik riwayat di kanan, lalu tabel dan penjelasannya dua kolom.
  - Ke depan: tiga kartu perkiraan berdampingan yang angka, grafik, dan lipatannya sejajar, lalu judul bagian di kiri dan tabelnya di kanan.
  - Banding: mulai 960 px pilihan negara di kanan judul, dan tiga kartu berdampingan yang kalimat, grafik, label, tabel, dan catatannya sejajar. Di lebar 720 sampai 959 px kartunya bertumpuk, dengan grafik dan catatan di kiri dan tabel di kanan.
  - Data per seri: grafik di kiri, angka terakhir dan tabelnya di kanan.
  - Tentang data: daftar isi di kiri, kalimat paling lebar 46rem, daftarnya dua kolom, dan tabel selebar halaman.
- **Grafik:** garis 2,25 px dengan warna pertanyaan halamannya, perkiraan putus-putus, pita rentang berwarna sama dengan kepekatan 16%, dan kisi abu tipis. Label grafik paling besar 13 px, dihitung dari lebar wadahnya. Di wadah yang lebih sempit daripada gambar aslinya label ikut mengecil: sekitar 9 sampai 13 px di HP 375 px, dan 9 px di kartu perkiraan pada lebar 960 px, yang kembali sekitar 13 px mulai lebar 1280 px. Di HP label grafik lebar dibesarkan supaya tetap terbaca. Di halaman Banding kedua garis putus-putus, karena keduanya proyeksi. Indonesia memakai warna pertanyaannya, dan negara lain memakai tinta dengan pola putus yang lebih rapat. Namanya ditulis di ujung garis, jadi warna bukan satu-satunya pembeda. Sumbunya selalu memuat nol, tebal garisnya tetap 2,25 px di semua ukuran, dan labelnya 12 sampai 13 px di semua lebar layar. Ketiga pasang warnanya diperiksa 2026-11-24 dengan pemeriksa palet buta warna: selisih warna terkecilnya 21,4 pada penglihatan buta warna dan 26,9 pada penglihatan biasa, dan kontras tiap garis minimal 3:1. Syarat pita terang dan kroma tidak dipenuhi tinta, yang memang netral.
- **Gerak:** satu-satunya gerak yang mulai sendiri adalah putaran globe di komputer, 4 derajat per detik atau satu putaran dalam 90 detik. Selebihnya hanya umpan balik: permukaan globe mengikuti seretan tanpa jeda dan sesudah dilepas melambat dengan tetapan waktu 325 ms, Indonesia di globe terangkat 3 px dengan bayangan dalam 150 ms saat kursor di atasnya, globe berputar menghadap Indonesia dalam 400 ms saat tautan namanya disorot, atau menghadap titik yang diketuk di HP, dan putaran itu bisa disela, kanvas globe muncul memudar dalam 200 ms, Indonesia di peta diam terangkat 1,5 px, dan tautan berganti warna halus dalam 150 ms. Bagi yang memilih kurangi animasi, globe tidak berputar dan tidak bisa dilempar, dan Indonesia di globe terangkat seketika tanpa animasi. Angkatan di peta diam dan semua transisi dimatikan.

## Aksesibilitas

- HTML semantik (`header`, `nav`, `main`, `section` berjudul, `table` dengan `caption` dan `scope`), dan tautan "Langsung ke isi".
- Fokus keyboard selalu terlihat, dan tidak tertutup kepala yang menempel.
- Kontras teks minimal 4,5:1. Garis data, titik, garis nol, dan batas antara resmi dan perkiraan di grafik minimal 3:1. Kisi dan pita rentang sengaja lebih pucat, karena nilainya juga tertulis di label sumbu, kalimat rentang, dan tabel rincian.
- Tidak ada geser horizontal halaman di lebar 320 px, dan tabel lebar digulir di wadahnya sendiri.
- Globe punya tautan teks di dekatnya, dan kanvasnya disembunyikan dari pembaca layar. Globe berhenti saat kursor ada di atas bola atau saat tautan namanya disorot kursor atau fokus keyboard, dan tidak berputar bagi yang memilih kurangi animasi. Putarannya mulai sendiri dan berlangsung lebih dari lima detik, jadi klik pada bola menghentikannya, dan fokus keyboard di tautan namanya menghentikannya sampai globe diseret atau diklik (WCAG 2.2.2). Sisi lain globe bisa dilihat tanpa menyeret: globe berputar sendiri di komputer, dan di HP atau bagi yang memilih kurangi animasi, ketukan atau klik pada bola menghadapkan titik itu (WCAG 2.5.7). Halaman negara selalu bisa dibuka dengan klik, ketukan, atau tautannya. Di mode warna paksa, kotak legenda tetap berwarna asli seperti kanvas globe, dan teks grafik serta garis negara lain di halaman Banding memakai warna teks sistem. Di mode itu pilihan negara dan pertanyaan yang sedang dibuka bergaris tepi, dan hanya menu yang sedang dibuka yang bergaris bawah. Bila globe gagal dimuat, tautan nama di dekatnya tetap di tempatnya, jadi fokus keyboard tidak hilang.

## Belum diputuskan

- Logo penuh. Sampai ada logo baru, tanda segitiga dan teks "Con-Fore" tetap dipakai.

## Riwayat uji

- Konsep kasar hitam-putih (halaman depan dan halaman Indonesia bentuk A, B, dan C) tayang di `/konsep/` 2026-11-20 sampai 2026-11-22. Bentuk C dipilih di tahap pilih dan dinyatakan lulus tahap lulus oleh pengelola (PRD 6).
- Tiga contoh gaya tayang di `/konsep/` pada 2026-11-22, dan gaya 3 dipilih.
- Keduanya sudah dihapus dari situs, dan isinya ada di riwayat git.
- Halaman Banding dibuat kasar hitam putih dulu pada 2026-11-24, lalu diberi gaya situs. Halaman ini belum diuji baca dengan orang lain.

## Referensi

- atlasgeopo.com (https://atlasgeopo.com/en): susunan peta dunia lalu profil negara, dan halaman pembanding negaranya (`/en/comparateur`) sebagai acuan halaman Banding: pilih negara dulu, lalu angkanya berdampingan. Gaya gelapnya menjadi gaya 1 di contoh gaya dan tidak dipilih. Logo, teks, ilustrasi, dan tata letak persisnya tidak disalin.
- USAFacts (https://usafacts.org/): waktu data di dekat angka, judul grafik berupa kalimat temuan, dan contoh hitung kecil untuk pembaca awam. Halaman Banding mengikuti kalimat temuan dan tanggal terbit di dekat angkanya. Kata real-time-nya tidak diambil.
- New York Fed Staff Nowcast (https://www.newyorkfed.org/research/policy/nowcast): rentang yang ditulis dalam kalimat, grafik kipas, dan tabel batas.
- Ringkasan visual laporan inflasi Bank of England, yang diuji dalam eksperimen Bank of England dan Behavioural Insights Team (https://www.bankofengland.co.uk/working-paper/2018/enhancing-central-bank-communications-with-behavioural-insights): bahasa sederhana dan contoh yang dekat dengan kehidupan sehari-hari, sebagai acuan cara bertutur.
- Plus Jakarta Sans (https://fonts.google.com/specimen/Plus+Jakarta+Sans): huruf gaya 3, buatan Tokotype.
- d3-geo (https://d3js.org/d3-geo): proyeksi ortografis untuk globe kanvas di halaman depan.
- Natural Earth (https://www.naturalearthdata.com/), lewat world-atlas (https://github.com/topojson/world-atlas): batas negara skala 1:110m untuk globe, domain publik.
- Emil Kowalski (https://emilkowal.ski/) dan Laws of UX karya Jon Yablonski (https://lawsofux.com/): umpan balik gerak yang singkat, ease-out untuk yang masuk layar, gerak panjang yang bisa disela, dan legenda yang diletakkan dekat globe.
- WCAG 2.2 (https://www.w3.org/TR/WCAG22/): kriteria 2.2.2 tentang menghentikan gerak yang mulai sendiri, dan 2.5.7 tentang jalan lain tanpa menyeret.
- Isu NVDA 9343 (https://github.com/nvaccess/nvda/issues/9343): tanda hubung lunak membuat pembaca layar memotong kata, jadi teks rata kiri kanan tidak dipenggal.

Sebelum keputusan desain baru (halaman atau layar baru, atau arah visual baru), buka daftar referensi desain yang disebut di aturan agent, kecuali proyek ini punya `.no-vault`, lalu catat referensi yang dipakai di sini. Baris ini tetap di sini.
