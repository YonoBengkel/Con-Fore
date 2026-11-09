Status: arah disetujui pengelola 2026-11-07, sesudah melihat beranda baru, lalu dipangkas dan diberi susunan baru atas keputusan pengelola 2026-11-09 (fase 5b di PRD). Susunan baru diterapkan dalam tiga tahap, jadi sampai tahap 3 tayang, sebagian aturan di bawah belum terlihat di situs. Menggantikan panduan 2026-10-31, karena pengelola memilih migrasi penuh ke arah atlasgeopo.com. Aturan narasi netral dan status tiga tingkat tetap dari panduan lama.

# Panduan desain Con-Fore

Panduan tampilan situs Con-Fore. Nilai tokennya ada di `web/app/globals.css`; dokumen ini hanya menjelaskan arah dan aturannya.

## Arah

- Ruang kendali malam: latar biru malam, segitiga berisi data asli di sampul, dan angka sebagai tokoh utama. Terasa seperti membaca alat ukur, bukan brosur.
- Referensi susunan dan ritme: atlasgeopo.com. Yang diambil adalah tiga peran huruf, data asli di pembuka, kartu berisi bukti, dan lapisan penjelas. Logo, teks, ilustrasi, dan tata letak persisnya tidak disalin.
- Tiga pola Atlas tidak dipakai, karena termasuk tren yang membuat situs terasa buatan AI: frasa miring berwarna di judul, label kecil huruf kapital di atas setiap judul, dan huruf mono untuk kata.
- Ciri sendiri: segitiga keseimbangan berisi data asli sebagai visual utama sampul Data dan Prediksi. Bukan globe, karena Con-Fore bicara satu negara lewat tiga angka. Tidak ada latar kisi segitiga di belakangnya, karena kisi itu menjadi segitiga kedua yang tidak membawa arti.
- Untuk pembaca awam yang kebanyakan membuka dari HP: satu kolom dulu, kalimat pendek, istilah dijelaskan di tempat ("artinya buatmu").
- Setiap angka membawa waktunya: periode data, tanggal rilis, dan rilis berikutnya selalu terlihat, tidak disembunyikan di lipatan (PRD 4.1).
- Netral: kalimat menjelaskan dan membandingkan, tanpa vonis dan tanpa nasihat. "Artinya buatmu" menjelaskan arti angka, bukan saran belanja. Aturannya di PRD 4.4.
- Jujur soal waktu: tanggal data selalu tertulis, dan kata "LIVE", "real-time", atau "langsung" tidak dipakai (PRD 4.4).
- Jelas independen. Tidak memakai lambang negara, warna merah-putih sebagai identitas, atau gaya visual BPS, Bank Indonesia, maupun kementerian. Kalimat "bukan situs resmi" selalu ada di kaki halaman.

## Warna

Selalu gelap, tanpa mode terang. Satu warna aksen, dipakai hemat: tombol utama, garis data, isi segitiga, dan tautan di dalam kalimat. Judul tidak memakai warna aksen.

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--latar` | `#070b14` | Latar halaman |
| `--permukaan` | `#111929` | Permukaan padat: tautan lewati, tepi titik grafik |
| `--kartu` | `#111929`, 78% | Kartu, panel, tabel |
| `--isi-lembut` | putih 4% | Kotak "Artinya buatmu" dan pintu penjelas |
| `--tinta` | `#eaeef7` | Teks utama dan judul |
| `--redup` | `#a8b3cb` | Teks pendukung |
| `--samar` | `#8d97ac` | Keterangan kecil, label, dan kepala tabel. Kontras minimal 4,5:1 di kartu |
| `--garis`, `--garis-kuat` | putih 9% dan 17% | Garis, kisi, tepi tombol |
| `--aksen` | `#6fdcea` | Lihat di atas |
| `--di-aksen` | `#05131a` | Teks di atas warna aksen |
| `--aksen-lembut`, `--isi-segitiga` | aksen 13% dan 20% | Lencana dan pilihan aktif, isi segitiga dan pita rentang |
| `--peringatan-*` | cokelat tua dan kuning lembut | Banner data basi, status "dari pemberitaan" |
| `--ok-tinta` | `#9fe3bd` | Status "dicocokkan ke dokumen" di tabel target |
| `--status-berat` | `#ff9aa8` | Status "tekanan berat" |
| `--fokus` | `#ffb070` | Garis fokus keyboard |

Warna tidak pernah menjadi satu-satunya pembawa arti: status selalu juga tertulis. Arah perubahan angka memakai warna netral dan kata "naik" atau "turun", karena naik tidak selalu baik: inflasi dan pengangguran justru sebaliknya.

## Huruf dan angka

Tiga peran huruf, disajikan dari Vercel sendiri lewat `next/font`, tanpa panggilan ke pihak ketiga dari browser:

| Peran | Huruf | Dipakai untuk |
|---|---|---|
| Cerita dan judul | Gelasio | `h1`, `h2`, judul kartu utama, merek |
| Antarmuka dan isi | Inter | Kalimat, navigasi, tombol, label, dan kepala tabel |
| Angka | JetBrains Mono | Angka data, tanggal, dan kode seri. Tidak untuk kata |

- Judul selalu tegak dan berwarna `--tinta`, tanpa kata atau frasa miring.
- Label kecil di atas judul (`.alis`) hanya dipakai bila membawa info baru, seperti periode, sumber, atau "Bukan angka resmi". Label yang mengulang judul dibuang. Label yang tersisa memakai Inter dengan huruf biasa, bukan kapital semua.
- Judul sampul 44 sampai 60 px dengan jarak baris 0,98, supaya tetap tiga baris di samping panel segitiga. `h1` halaman lain 36 sampai 44 px, dan `h2` 28 sampai 38 px, bobot 400.
- Teks dasar 16,5 px dengan jarak baris 1,6. Tidak ada teks di bawah 12 px.
- Angka memakai format Indonesia: koma desimal, titik ribuan, dan tanda persen menempel ("5,5%", "18.143"). Selisih dua persentase ditulis "poin persen". Kalimat memakai kata biasa ("dibanding setahun sebelumnya"), label pendek memakai "tahunan", dan "y-on-y" disebut sekali di penjelas (PRD 4.4).

## Bentuk dan gerak

- Radius 10 px (tombol, kotak kecil), 14 px (kartu, tabel), 18 px (panel besar). Bayangan hanya untuk panel segitiga di sampul.
- Wadah 1240 px. Kepala 56 px dan menempel di atas mulai lebar 720 px. Di HP kepala tidak menempel, supaya ruang baca tidak berkurang.
- Tidak ada animasi selain transisi warna 150 ms, yang dimatikan saat `prefers-reduced-motion`.

## Komponen

- **Menu:** Data, Prediksi, dan Metode. Banding ditambahkan saat fase 7 tayang. Alamat lama `/cara-kerja` dan `/sumber` dialihkan permanen ke bagiannya di `/metode`.
- **Sampul beranda:** judul tegak, satu kalimat, lalu segitiga keseimbangan sebagai visual utama bersama kalimat ringkasan, status tiga tingkat, dan pilihan lensa. Di bawahnya dua tombol dan waktu pembaruan otomatis terakhir. Tidak ada deret angka hiasan seperti jumlah seri atau jumlah sumber.
- **Sampul tab Prediksi:** susunan yang sama dengan beranda, dengan judul "Ke mana arahnya, dan seberapa yakin." dan segitiga perkiraan sebagai visual utama.
- **Segitiga keseimbangan:** SVG, tiga sudut (Pertumbuhan, Harga stabil, Lapangan kerja), kisi 25/50/75/100, skor bulat di tiap sudut. Kalimat ringkasan di sebelahnya menjadi teks alternatif (`aria-labelledby`).
- **Pilihan lensa:** dua tombol segmen ("Masa lalu", "Target resmi"), tersimpan di URL.
- **Kartu angka:** judul, nama seri, angka, perubahan, grafik kecil, lencana label kejujuran, dan tautan riwayat dan unduh CSV. Periode data, tanggal rilis, dan tanggal rilis berikutnya selalu terlihat. Bila sumbernya tidak mencatat tanggal rilis per angka (WebAPI BPS), yang tampil tanggal Con-Fore pertama kali melihat angka itu, dengan label "Dilihat Con-Fore". Kartu utama menampilkan "Artinya buatmu". Kartu penggerak melipatnya bersama sumber, supaya delapan kartu tetap terbaca sekilas.
- **Baris rilis berikutnya:** satu baris di bawah tiga kartu utama, berisi tanggal rilis berikutnya untuk ketiganya.
- **Kartu perkiraan:** kalimat utama yang memuat angka dan rentangnya, misalnya (angka contoh) "diperkirakan 2,1%, kemungkinan antara 1,6% dan 2,6%", lalu grafik, label, dan "Artinya buatmu" terbuka. Arti "kemungkinan" dijelaskan sekali di tab Prediksi. "Kenapa perkiraannya begini" dan rincian per periode dilipat.
- **Tabel batas:** tabel kecil berisi periode, perkiraan, batas bawah, dan batas atas. Satu-satunya tempat istilah "rentang 80%".
- **Rekam jejak:** selisih dalam poin persen, dan cakupan rentang sebagai hitungan ("3 dari 4 perkiraan jatuh di dalam rentangnya"), dibanding angka resmi pertama.
- **Halaman detail:** letak halaman, judul, satu baris keterangan, pintu penjelas, tautan pil ke seri sekelompok, lalu angka terakhir, riwayat dengan penggeser, catatan revisi bila ada, dan angka terbaru. Di HP angka terakhir tampil lebih dulu.
- **Pintu penjelas:** kotak selebar isi tepat di bawah judul halaman detail, bertuliskan "Baru kenal angka ini? Mulai dari penjelasan singkatnya.", yang membawa ke penjelas empat bagian.
- **Penjelas empat bagian:** apa yang diukur, cara dan sumber, cara membacanya, dan yang bisa diambil. Bagian terakhir dihitung dari riwayat seri itu, tanpa penilaian. Dilipat dengan `details`, jadi tetap jalan tanpa JavaScript.
- **Contoh hitung:** "Artinya buatmu" inflasi memakai belanja Rp100.000, dan pengangguran memakai "dari 100 orang angkatan kerja". Angkanya tetap dan tidak pernah meminta data pribadi. Angka lain tidak diberi contoh uang (PRD 4.4).
- **Catatan revisi:** baris di halaman detail berisi periode, angka lama, angka baru, dan tanggal rilis revisinya, ditambah satu kalimat tentang sejak kapan revisi dicatat. Hanya muncul bila angka yang tampil berubah sesudah dibulatkan, dan tidak tampil di kartu beranda.
- **Penggeser riwayat:** pilih periode dengan penggeser, dua tombol, atau menunjuk grafik, lalu kalimat di bawahnya menjelaskan angka periode itu. Tanpa JavaScript tetap tampil periode terakhir.
- **Halaman Metode:** gabungan Cara kerja dan Sumber data, dengan daftar isi yang menempel di layar lebar. Label di bagian "Arti label" tampil persis seperti di kartu. Jadwal pembaruan ditulis sebagai rentang jam yang teramati dalam WIB, bukan jam jadwal.
- **Judul grafik:** kalimat temuan netral yang dibuat dari templat (naik, turun, atau tetap), dengan anak judul berisi nama seri, satuan, dan rentang waktu.
- **Tabel target:** tabel biasa di layar lebar; di HP setiap baris menjadi blok berlabel.
- **Banner:** cokelat tua dengan teks kuning lembut, hanya untuk data yang mungkin basi atau sumber yang gagal.
- **Grafik per ronde:** satu garis per bulan survei, garis kedua putus-putus, dan label langsung di ujung garis. Dipakai untuk porsi pekerja formal, karena ronde yang berbeda bulan tidak sepadan.
- **Grafik per kelompok:** satu panel kecil per kelompok dengan skala yang sama dan garis nol, warna `--aksen`, titik dan label angka di ujung garis, tanpa legenda karena judul panel sudah menyebut kelompoknya. Dipakai untuk rincian inflasi, karena ketiga garisnya sering bersilangan. Satu kolom di HP, tiga kolom mulai 960 px. Teks panel tetap terbaca di HP karena lebar gambarnya 320, bukan 640.
- **Segitiga perkiraan:** segitiga yang sama, dengan garis putus-putus untuk tahun perkiraan dan garis tipis `--redup` tanpa isi untuk tahun resmi terakhir. Skor di sudut milik tahun perkiraan. Dipakai di sampul tab Prediksi.
- **Grafik perkiraan:** garis utuh `--aksen` untuk angka resmi, garis putus-putus untuk perkiraan, dan pita `--isi-segitiga` untuk rentang 80%. Pita mulai dari titik resmi terakhir, tanpa lebar, dan tidak digambar untuk horizon yang belum punya rentang. Garis tegak memisahkan label "Resmi" dan "Perkiraan". Satu warna, tanpa legenda, karena satu kalimat di atas grafik menjelaskan ketiganya. Sumbu waktu mengikuti jarak bulan sebenarnya, supaya ronde TPT yang tidak rata tetap benar. Lebar gambarnya 360, supaya teksnya terbaca di HP dan di kartu tiga kolom. Begitu rekam jejak terisi, perkiraan lama tampil sebagai titik berongga dan angka resmi pertama sebagai titik penuh, dan kalimat di atas grafik menyebut keduanya.
- **Grafik jangka panjang:** garis utuh untuk angka resmi, putus-putus untuk proyeksi IMF, dan titik berongga `--tinta` untuk target RPJMN, dengan label langsung di ujungnya. Pembedanya bentuk, bukan warna.
- **Status tiga tingkat** (PRD 4.4): daftar tiga baris di samping segitiga, berisi nama dimensi, skor, ikon, dan kata, tanpa latar berwarna. Normal memakai `--redup` dengan lingkaran kosong. Perlu waspada memakai `--tinta` tebal dengan lingkaran setengah isi. Tekanan berat memakai `--status-berat` tebal dengan lingkaran penuh. Jadi warna hanya muncul di tingkat terberat. Ikonnya SVG kecil, bukan emoji, dan disembunyikan dari pembaca layar karena katanya sudah tertulis. Tidak memakai kuning `--peringatan-*` (data basi), hijau `--ok-tinta` (sumber dicocokkan ke dokumen), atau jingga `--fokus` (fokus keyboard), dan tidak pernah menjadi banner atau judul.
- **Tanda merek dan ikon situs:** garis luar segitiga warna aksen (`web/app/icon.svg`).

## Aksesibilitas

- HTML semantik (`header`, `nav`, `main`, `section` berjudul, `table` dengan `caption` dan `scope`), tautan "Langsung ke isi".
- Fokus keyboard selalu terlihat, dan tidak tertutup kepala yang menempel (`scroll-padding-top`).
- Kontras teks minimal 4,5:1 di latar dan kartu, termasuk bagian latar yang paling terang.
- Tidak ada geser horizontal halaman di lebar 320 px; tabel lebar digulir di wadahnya sendiri.

## Belum diputuskan

- Logo penuh (sekarang tanda segitiga dan teks "Con-Fore"). Dibahas sesudah fase 7.

## Referensi

- atlasgeopo.com (https://atlasgeopo.com/en): susunan dan ritme, rinciannya di bagian Arah. Halaman pembanding negaranya (`/en/comparateur`, dua kolom) menjadi acuan halaman pembanding fase 7.
- New York Fed Staff Nowcast (https://www.newyorkfed.org/research/policy/nowcast): rentang yang masuk ke kalimat, grafik, dan tabel batas, untuk kartu perkiraan dan rekam jejak.
- USAFacts (https://usafacts.org/): waktu yang ditulis di dekat angka, judul grafik berupa kalimat temuan, dan contoh hitung untuk pembaca awam. Kata real-time-nya tidak diambil.

Sebelum keputusan desain baru (halaman atau layar baru, atau arah visual baru), buka daftar referensi desain yang disebut di aturan agent, kecuali proyek ini punya `.no-vault`, lalu catat referensi yang dipakai di sini. Baris ini tetap di sini.
