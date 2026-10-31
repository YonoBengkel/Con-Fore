Status: disetujui pengelola 2026-10-31.

# Panduan desain Con-Fore

Panduan tampilan situs Con-Fore, ditulis dari tampilan tab Data v0.1 di `web/`. Nilai tokennya ada di `web/app/globals.css`; dokumen ini hanya menjelaskan arah dan aturannya.

## Arah

- Tenang dan bisa dipercaya, bukan mencolok. Angka menjadi tokoh utama; hiasan tidak ada.
- Untuk pembaca awam yang kebanyakan membuka dari HP: satu kolom dulu, kalimat pendek, istilah dijelaskan di tempat ("artinya buatmu").
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

## Aksesibilitas

- HTML semantik (`header`, `nav`, `main`, `section` berjudul, `table` dengan `caption` dan `scope`), tautan "Langsung ke isi".
- Fokus keyboard selalu terlihat; tidak ada animasi selain transisi warna singkat yang dimatikan saat `prefers-reduced-motion`.
- Tidak ada geser horizontal halaman di lebar 375 px; tabel lebar digulir di wadahnya sendiri.

## Belum diputuskan

- Logo atau tanda merek (sekarang hanya teks "Con-Fore").
- Gaya tab Prediksi: garis putus-putus untuk perkiraan dan pita rentang ketidakpastian.
