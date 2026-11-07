Status: arah disetujui pengelola 2026-11-07, sesudah melihat beranda baru. Menggantikan panduan 2026-10-31, karena pengelola memilih migrasi penuh ke arah atlasgeopo.com. Aturan narasi netral dan status tiga tingkat tetap dari panduan lama.

# Panduan desain Con-Fore

Panduan tampilan situs Con-Fore. Nilai tokennya ada di `web/app/globals.css`; dokumen ini hanya menjelaskan arah dan aturannya.

## Arah

- Ruang kendali malam: latar biru malam, panel instrumen, dan angka sebagai tokoh utama. Terasa seperti membaca alat ukur, bukan brosur.
- Referensi susunan dan ritme: atlasgeopo.com. Yang diambil adalah tiga peran huruf, panel data asli di pembuka, kartu berisi bukti, dan lapisan penjelas. Logo, teks, ilustrasi, dan tata letak persisnya tidak disalin.
- Ciri sendiri: kisi segitiga keseimbangan yang dibesarkan menjadi cakrawala di latar. Bukan globe, karena Con-Fore bicara satu negara lewat tiga angka.
- Untuk pembaca awam yang kebanyakan membuka dari HP: satu kolom dulu, kalimat pendek, istilah dijelaskan di tempat ("artinya buatmu").
- Netral: kalimat menjelaskan dan membandingkan, tanpa vonis dan tanpa nasihat. "Artinya buatmu" menjelaskan arti angka, bukan saran belanja. Aturannya di PRD 4.4.
- Jujur soal waktu: tanggal data selalu tertulis, dan kata "LIVE", "real-time", atau "langsung" tidak dipakai (PRD 4.4).
- Jelas independen. Tidak memakai lambang negara, warna merah-putih sebagai identitas, atau gaya visual BPS, Bank Indonesia, maupun kementerian. Kalimat "bukan situs resmi" selalu ada di kaki halaman.

## Warna

Selalu gelap, tanpa mode terang. Satu warna aksen, dipakai hemat: judul miring di sampul, tombol utama, garis data, dan tautan di dalam kalimat.

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--latar` | `#070b14` | Latar halaman |
| `--permukaan` | `#111929` | Permukaan padat: tautan lewati, tepi titik grafik |
| `--kartu` | `#111929`, 78% | Kartu, panel, tabel, supaya kisi latar samar terlihat |
| `--isi-lembut` | putih 4% | Kotak "Artinya buatmu" |
| `--tinta` | `#eaeef7` | Teks utama |
| `--redup` | `#a8b3cb` | Teks pendukung |
| `--samar` | `#8d97ac` | Keterangan kecil dan kepala tabel. Kontras minimal 4,5:1 di kartu |
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
| Antarmuka dan isi | Inter | Kalimat, navigasi, tombol |
| Data dan label | JetBrains Mono | Semua angka data, label huruf besar kecil (`.alis`), kepala tabel |

- Judul sampul 44 sampai 76 px dengan jarak baris 0,98. `h1` halaman lain 36 sampai 44 px, dan `h2` 28 sampai 38 px, bobot 400.
- Teks dasar 16,5 px dengan jarak baris 1,6. Tidak ada teks di bawah 12 px.
- Angka memakai format Indonesia (koma desimal, titik ribuan): "5,5%", "18.143".

## Bentuk dan gerak

- Radius 10 px (tombol, kotak kecil), 14 px (kartu, tabel), 18 px (panel besar). Bayangan hanya untuk panel instrumen.
- Wadah 1240 px. Kepala 56 px dan menempel di atas mulai lebar 720 px. Di HP kepala tidak menempel, supaya ruang baca tidak berkurang.
- Tidak ada animasi selain transisi warna 150 ms, yang dimatikan saat `prefers-reduced-motion`.

## Komponen

- **Latar kisi:** kisi segitiga SVG, `position: fixed`, hanya di beranda dan tab Prediksi. Murni SVG tanpa JavaScript, dan tersembunyi dari pembaca layar.
- **Sampul beranda:** judul dengan bagian miring warna aksen, satu kalimat, tiga fakta bernilai asli, dua tombol, dan waktu pembaruan terakhir. Di sebelahnya panel instrumen.
- **Sampul tab Prediksi:** susunan yang sama dengan beranda, dengan judul "Ke mana arahnya, dan seberapa yakin." dan panel berisi tiga perkiraan.
- **Panel instrumen:** satu baris per angka utama, berisi nama, angka, periode dan arah perubahan atau rentang, dan grafik kecil. Di beranda setiap baris menuju halaman detail, dan kepalanya menulis "Data terbit terakhir", bukan "LIVE". Di tab Prediksi setiap baris menuju kartu perkiraannya, dan kepalanya menulis "Bukan angka resmi".
- **Segitiga keseimbangan:** SVG, tiga sudut (Pertumbuhan, Harga stabil, Lapangan kerja), kisi 25/50/75/100, skor bulat di tiap sudut. Kalimat ringkasan di sebelahnya menjadi teks alternatif (`aria-labelledby`).
- **Pilihan lensa:** dua tombol segmen ("Masa lalu", "Target resmi"), tersimpan di URL.
- **Kartu angka:** judul, nama seri, angka, periode dan perubahan, grafik kecil, lencana label kejujuran, dan tautan riwayat dan unduh CSV. Kartu utama menampilkan "Artinya buatmu". Kartu penggerak melipatnya bersama sumber, supaya delapan kartu tetap terbaca sekilas. Sumber dan jadwal rilis ada di lipatan pada keduanya.
- **Kartu perkiraan:** angka, rentang, grafik, label, dan "Artinya buatmu" terbuka. "Kenapa perkiraannya begini" dan rincian per periode dilipat.
- **Halaman detail:** letak halaman, judul, satu baris keterangan, tombol "Memahami angka ini", tautan pil ke seri sekelompok, lalu angka terakhir, riwayat dengan penggeser, dan angka terbaru. Di HP angka terakhir tampil lebih dulu.
- **Penjelas empat bagian:** apa yang diukur, cara dan sumber, cara membacanya, dan yang bisa diambil. Bagian terakhir dihitung dari riwayat seri itu, tanpa penilaian. Dilipat dengan `details`, jadi tetap jalan tanpa JavaScript.
- **Penggeser riwayat:** pilih periode dengan penggeser, dua tombol, atau menunjuk grafik, lalu kalimat di bawahnya menjelaskan angka periode itu. Tanpa JavaScript tetap tampil periode terakhir.
- **Halaman bacaan:** Cara kerja memakai daftar isi yang menempel di layar lebar, dan label di bagian "Arti label" tampil persis seperti di kartu.
- **Tabel target:** tabel biasa di layar lebar; di HP setiap baris menjadi blok berlabel.
- **Banner:** cokelat tua dengan teks kuning lembut, hanya untuk data yang mungkin basi atau sumber yang gagal.
- **Grafik per ronde:** satu garis per bulan survei, garis kedua putus-putus, dan label langsung di ujung garis. Dipakai untuk porsi pekerja formal, karena ronde yang berbeda bulan tidak sepadan.
- **Grafik per kelompok:** satu panel kecil per kelompok dengan skala yang sama dan garis nol, warna `--aksen`, titik dan label angka di ujung garis, tanpa legenda karena judul panel sudah menyebut kelompoknya. Dipakai untuk rincian inflasi, karena ketiga garisnya sering bersilangan. Satu kolom di HP, tiga kolom mulai 960 px. Teks panel tetap terbaca di HP karena lebar gambarnya 320, bukan 640.
- **Segitiga perkiraan:** segitiga yang sama, dengan garis putus-putus untuk tahun perkiraan dan garis tipis `--redup` tanpa isi untuk tahun resmi terakhir. Skor di sudut milik tahun perkiraan. Dipakai di tab Prediksi.
- **Grafik perkiraan:** garis utuh `--aksen` untuk angka resmi, garis putus-putus untuk perkiraan, dan pita `--isi-segitiga` untuk rentang 80%. Pita mulai dari titik resmi terakhir, tanpa lebar, dan tidak digambar untuk horizon yang belum punya rentang. Garis tegak memisahkan label "Resmi" dan "Perkiraan". Satu warna, tanpa legenda, karena satu kalimat di atas grafik menjelaskan ketiganya. Sumbu waktu mengikuti jarak bulan sebenarnya, supaya ronde TPT yang tidak rata tetap benar. Lebar gambarnya 360, supaya teksnya terbaca di HP dan di kartu tiga kolom.
- **Grafik jangka panjang:** garis utuh untuk angka resmi, putus-putus untuk proyeksi IMF, dan titik berongga `--tinta` untuk target RPJMN, dengan label langsung di ujungnya. Pembedanya bentuk, bukan warna.
- **Status tiga tingkat** (PRD 4.4): daftar tiga baris di samping segitiga, berisi nama dimensi, skor, ikon, dan kata, tanpa latar berwarna. Normal memakai `--redup` dengan lingkaran kosong. Perlu waspada memakai `--tinta` tebal dengan lingkaran setengah isi. Tekanan berat memakai `--status-berat` tebal dengan lingkaran penuh. Jadi warna hanya muncul di tingkat terberat. Ikonnya SVG kecil, bukan emoji, dan disembunyikan dari pembaca layar karena katanya sudah tertulis. Tidak memakai kuning `--peringatan-*` (data basi), hijau `--ok-tinta` (sumber dicocokkan ke dokumen), atau jingga `--fokus` (fokus keyboard), dan tidak pernah menjadi banner atau judul.
- **Tanda merek dan ikon situs:** garis luar segitiga warna aksen (`web/app/icon.svg`).

## Aksesibilitas

- HTML semantik (`header`, `nav`, `main`, `section` berjudul, `table` dengan `caption` dan `scope`), tautan "Langsung ke isi".
- Fokus keyboard selalu terlihat, dan tidak tertutup kepala yang menempel (`scroll-padding-top`).
- Kontras teks minimal 4,5:1 di latar dan kartu, termasuk bagian latar yang paling terang.
- Tidak ada geser horizontal halaman di lebar 320 px; tabel lebar digulir di wadahnya sendiri.

## Belum diputuskan

- Logo penuh (sekarang tanda segitiga dan teks "Con-Fore").
