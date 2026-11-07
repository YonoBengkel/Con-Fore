Status: disetujui pengelola 2026-10-31. Aturan narasi netral, status tiga tingkat, dan warnanya ditambahkan 2026-11-03 dengan persetujuan pengelola.

# Panduan desain Con-Fore

Panduan tampilan situs Con-Fore, ditulis dari tampilan tab Data v0.1 di `web/`. Nilai tokennya ada di `web/app/globals.css`; dokumen ini hanya menjelaskan arah dan aturannya.

## Arah

- Tenang dan bisa dipercaya, bukan mencolok. Angka menjadi tokoh utama; hiasan tidak ada.
- Untuk pembaca awam yang kebanyakan membuka dari HP: satu kolom dulu, kalimat pendek, istilah dijelaskan di tempat ("artinya buatmu").
- Netral: kalimat menjelaskan dan membandingkan, tanpa vonis dan tanpa nasihat. "Artinya buatmu" menjelaskan arti angka, bukan saran belanja. Aturannya di PRD 4.4.
- Jelas independen. Tidak memakai lambang negara, warna merah-putih sebagai identitas, atau gaya visual BPS, Bank Indonesia, maupun kementerian. Kalimat "bukan situs resmi" selalu ada di kaki halaman.

## Warna

Satu warna aksen (hijau kebiruan tua) di atas latar kertas hangat; tema gelap mengikuti `prefers-color-scheme`.

| Token | Terang | Gelap | Dipakai untuk |
|---|---|---|---|
| `--latar` | `#f6f5f1` | `#131517` | Latar halaman |
| `--permukaan` | `#ffffff` | `#1b1f22` | Kartu, panel, kepala |
| `--tinta` | `#1c2024` | `#e9e7e2` | Teks utama |
| `--redup` | `#545c64` | `#a7aeb5` | Teks pendukung (kontras minimal 4,5:1) |
| `--garis` | `#d9d6cc` | `#343a40` | Garis dan kisi |
| `--aksen` | `#0e5c66` | `#74c4cf` | Tautan, garis grafik, segitiga, pilihan aktif |
| `--peringatan-*` | kuning lembut | cokelat tua | Banner data basi, status "dari pemberitaan" |
| `--ok-tinta` | `#1f5a2c` | `#9fd8a9` | Status "dicocokkan ke dokumen" di tabel target |
| `--status-berat` | `#a4133c` | `#ff8fa3` | Status "tekanan berat". Kontras minimal 7:1 di latar dan permukaan kedua tema |
| `--fokus` | `#b34700` | `#ffb070` | Garis fokus keyboard |

Warna tidak pernah menjadi satu-satunya pembawa arti: status selalu juga tertulis.

## Huruf dan angka

- Huruf sistem (`system-ui` dan cadangannya), tanpa unduhan huruf.
- Angka memakai `tabular-nums` dan format Indonesia (koma desimal, titik ribuan): "5,1%", "18.143".
- Angka utama kartu 2,5rem; angka penggerak 1,75rem; teks dasar 1,0625rem dengan jarak baris 1,6.

## Komponen

- **Segitiga keseimbangan:** SVG, tiga sudut (Pertumbuhan, Harga stabil, Lapangan kerja), kisi 25/50/75/100, skor bulat di tiap sudut. Kalimat ringkasan di sebelahnya menjadi teks alternatif (`aria-labelledby`).
- **Pilihan lensa:** dua tombol segmen ("Masa lalu", "Target resmi"), tersimpan di URL.
- **Kartu angka:** judul, nama seri, angka, periode dan perubahan, grafik kecil, lencana label kejujuran, kotak "Artinya buatmu", rincian sumber dan tanggal, tautan riwayat dan unduh CSV.
- **Tabel target:** tabel biasa di layar lebar; di HP setiap baris menjadi blok berlabel.
- **Banner:** kuning lembut, hanya untuk data yang mungkin basi atau sumber yang gagal.
- **Grafik per ronde:** satu garis per bulan survei, garis kedua putus-putus, dan label langsung di ujung garis. Dipakai untuk porsi pekerja formal, karena ronde yang berbeda bulan tidak sepadan.
- **Grafik per kelompok:** satu panel kecil per kelompok dengan skala yang sama dan garis nol, warna `--aksen`, titik dan label angka di ujung garis, tanpa legenda karena judul panel sudah menyebut kelompoknya. Dipakai untuk rincian inflasi, karena ketiga garisnya sering bersilangan. Satu kolom di HP, tiga kolom mulai 960 px. Teks panel tetap terbaca di HP karena lebar gambarnya 320, bukan 640.
- **Segitiga perkiraan:** segitiga yang sama, dengan garis putus-putus untuk tahun perkiraan dan garis tipis `--redup` tanpa isi untuk tahun resmi terakhir. Skor di sudut milik tahun perkiraan. Dipakai di tab Prediksi.
- **Grafik perkiraan:** garis utuh `--aksen` untuk angka resmi, garis putus-putus untuk perkiraan, dan pita `--isi-segitiga` untuk rentang 80%. Pita mulai dari titik resmi terakhir, tanpa lebar, dan tidak digambar untuk horizon yang belum punya rentang. Garis tegak memisahkan label "Resmi" dan "Perkiraan". Satu warna, tanpa legenda, karena satu kalimat di atas grafik menjelaskan ketiganya. Sumbu waktu mengikuti jarak bulan sebenarnya, supaya ronde TPT yang tidak rata tetap benar. Lebar gambarnya 360, supaya teksnya terbaca di HP dan di kartu tiga kolom.
- **Grafik jangka panjang:** garis utuh untuk angka resmi, putus-putus untuk proyeksi IMF, dan titik berongga `--tinta` untuk target RPJMN, dengan label langsung di ujungnya. Pembedanya bentuk, bukan warna.
- **Status tiga tingkat** (PRD 4.4): daftar tiga baris di samping segitiga, berisi nama dimensi, skor, ikon, dan kata, tanpa latar berwarna. Normal memakai `--redup` dengan lingkaran kosong. Perlu waspada memakai `--tinta` tebal dengan lingkaran setengah isi. Tekanan berat memakai `--status-berat` tebal dengan lingkaran penuh. Jadi warna hanya muncul di tingkat terberat. Ikonnya SVG kecil, bukan emoji, dan disembunyikan dari pembaca layar karena katanya sudah tertulis. Tidak memakai kuning `--peringatan-*` (data basi), hijau `--ok-tinta` (sumber dicocokkan ke dokumen), atau jingga `--fokus` (fokus keyboard), dan tidak pernah menjadi banner atau judul.

Ikon situs (`web/app/icon.svg`): satu segitiga warna aksen, mengikuti tema terang dan gelap.

## Aksesibilitas

- HTML semantik (`header`, `nav`, `main`, `section` berjudul, `table` dengan `caption` dan `scope`), tautan "Langsung ke isi".
- Fokus keyboard selalu terlihat; tidak ada animasi selain transisi warna singkat yang dimatikan saat `prefers-reduced-motion`.
- Tidak ada geser horizontal halaman di lebar 375 px; tabel lebar digulir di wadahnya sendiri.

## Belum diputuskan

- Logo atau tanda merek (sekarang hanya teks "Con-Fore").
- Arah visual Atlas lawan panduan ini. Sampai diputuskan, tab Prediksi juga mengikuti panduan ini.
