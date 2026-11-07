// Cara kerja: data, pembaruan, label, dan aturan skor segitiga dalam bahasa sehari-hari.

import type { Metadata } from "next";
import Link from "next/link";
import { angka } from "@/lib/format";
import { KELOMPOK_INFLASI } from "@/lib/konten";
import { AMBANG_PORSI } from "@/lib/pekerja";
import { AMBANG_STATUS, PATOKAN_INFLASI, POIN_PER_PP, TAHUN_AKHIR, TAHUN_AWAL } from "@/lib/skor";

export const metadata: Metadata = {
  title: "Cara kerja",
  description: "Dari mana angka Con-Fore berasal, kapan diperbarui, dan bagaimana skor segitiga dihitung.",
};

const BAGIAN = [
  ["asal", "Dari mana angkanya"],
  ["pembaruan", "Kapan diperbarui"],
  ["label", "Arti label"],
  ["skor", "Skor segitiga"],
  ["pekerja-formal", "Pekerja formal dan informal"],
  ["rincian-inflasi", "Rincian inflasi"],
  ["perkiraan", "Perkiraan"],
  ["unduhan", "Unduhan"],
];

export default function CaraKerja() {
  return (
    <div className="halaman-bacaan">
      <nav aria-label="Isi halaman" className="daftar-isi">
        <ul>
          {BAGIAN.map(([id, nama]) => (
            <li key={id}>
              <a href={`#${id}`}>{nama}</a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="prosa">
      <section className="pembuka">
        <h1>Cara kerja</h1>
        <p>
          Con-Fore merangkum ekonomi Indonesia lewat tiga angka: pertumbuhan ekonomi, inflasi, dan
          pengangguran. Halaman ini menjelaskan dari mana angkanya, kapan diperbarui, dan cara
          menghitung skor segitiga.
        </p>
      </section>

      <h2 id="asal">Dari mana angkanya</h2>
      <ul>
        <li>
          Setiap hari sebuah program otomatis mengambil data publik dari lembaga sumber (BPS, IMF, BIS,
          OECD, dan ECB), lalu menyimpannya. Situs ini hanya membaca hasil olahan itu. Daftar lengkapnya
          ada di <Link href="/sumber">Sumber data</Link>.
        </li>
        <li>
          Angka Indonesia diambil langsung dari BPS. Bila angka BPS belum tersedia, dipakai salinan IMF
          dari data BPS, yang biasanya terbit beberapa minggu setelah rilis BPS. Label di setiap angka
          menyebut mana yang dipakai.
        </li>
        <li>Setiap angka mencantumkan sumber, periode, dan tanggal Con-Fore melihatnya.</li>
      </ul>

      <h2 id="pembaruan">Kapan diperbarui</h2>
      <ul>
        <li>
          Setiap pagi program memeriksa semua sumber. Jadwalnya pukul 06.17 WIB, tetapi bisa mulai beberapa
          jam lebih lambat karena antrean di layanan yang menjalankannya.
        </li>
        <li>
          Pada tanggal 1 sampai 8 setiap bulan, saat BPS biasanya merilis angka, ada pemeriksaan tambahan
          khusus data BPS yang dijadwalkan sore hari dan juga bisa terlambat. Angka baru biasanya tampil
          paling lambat pagi setelah hari rilis.
        </li>
        <li>Perkiraan dihitung ulang bila data masukannya berubah. Uji dengan data lama diulang setiap tanggal 9.</li>
        <li>Bila pembaruan gagal lebih dari 36 jam, halaman menampilkan peringatan.</li>
      </ul>

      <h2 id="label">Arti label</h2>
      <ul className="daftar-label">
        <li>
          <span className="lencana">data resmi BPS</span> Diambil langsung dari BPS.
        </li>
        <li>
          <span className="lencana">salinan IMF dari data BPS</span> Angka BPS yang diterbitkan ulang oleh IMF.
        </li>
        <li>
          <span className="lencana">dihitung Con-Fore</span> Olahan Con-Fore dari data sumber, misalnya pertumbuhan
          dibanding tahun lalu yang dihitung dari PDB riil, atau kurs rupiah per dolar dari dua kurs acuan ECB.
        </li>
        <li>
          <span className="lencana">data IMF, BIS, OECD, ECB</span> Data lembaga itu apa adanya.
        </li>
        <li>
          <span className="lencana lencana-perkiraan">perkiraan Con-Fore</span> Hasil perhitungan Con-Fore untuk periode
          yang belum terbit, ada di tab Prediksi.
        </li>
        <li>
          <span className="lencana">proyeksi IMF</span> Proyeksi IMF World Economic Outlook apa adanya.
        </li>
      </ul>
      <p>Tab Data tidak memuat ramalan. Perkiraan hanya ada di tab Prediksi, dengan label sendiri.</p>

      <h2 id="skor">Skor segitiga</h2>
      <p>
        Segitiga memakai tahun terakhir yang ketiga angka tahunannya sudah terbit. Setiap sudut diberi
        skor 0 sampai 100; makin besar segitiganya, makin baik keadaannya. Ada dua cara membandingkan
        (lensa), dan pilihanmu tersimpan di alamat halaman.
      </p>
      <h3>Lensa masa lalu (bawaan)</h3>
      <ul>
        <li>
          Tahun itu dibandingkan dengan tahun {TAHUN_AWAL} sampai {TAHUN_AKHIR} dari data IMF World
          Economic Outlook.
        </li>
        <li>Pertumbuhan: makin tinggi makin baik.</li>
        <li>
          Harga stabil: makin dekat inflasi akhir tahun ke {String(PATOKAN_INFLASI).replace(".", ",")}%
          makin baik, baik inflasinya terlalu tinggi maupun terlalu rendah.
        </li>
        <li>Lapangan kerja: makin rendah pengangguran makin baik.</li>
        <li>
          Skornya adalah persentil: persen tahun pembanding yang lebih buruk, ditambah separuh dari
          tahun yang sama baiknya (termasuk tahun itu sendiri), jadi tahun terbaik pun mendapat skor
          sedikit di bawah 100. Skor 50 berarti di tengah; skor 90 berarti lebih baik dari sekitar 9
          dari 10 tahun sejak {TAHUN_AWAL}.
        </li>
      </ul>
      <h3>Lensa target</h3>
      <ul>
        <li>
          Skor 100 bila angka berada di zona target: pertumbuhan minimal target APBN, inflasi akhir
          tahun di dalam sasaran ± 1 poin persen, dan pengangguran di bawah batas atas target APBN.
        </li>
        <li>
          Skor turun {POIN_PER_PP} untuk setiap 1 poin persen di luar zona, dan tidak pernah di bawah 0.
        </li>
        <li>Hanya tersedia untuk tahun yang ketiga targetnya lengkap.</li>
        <li>
          Daftar target beserta dokumen dan status pemeriksaannya ada di{" "}
          <Link href="/sumber#target">Sumber data</Link>.
        </li>
      </ul>
      <h3>Status tiga tingkat</h3>
      <p>
        Setiap sudut juga diberi status supaya skornya lebih mudah dibaca. Status menunjukkan posisi
        angka dibanding pembandingnya, bukan vonis tentang ekonomi. Status dihitung dari skor sebelum
        dibulatkan, dan ambangnya berbeda per lensa karena arti skornya berbeda.
      </p>
      <ul>
        <li>
          Lensa masa lalu: normal bila skor {AMBANG_STATUS.masaLalu.waspada} ke atas, perlu waspada bila{" "}
          {AMBANG_STATUS.masaLalu.berat} sampai di bawah {AMBANG_STATUS.masaLalu.waspada}, dan tekanan
          berat bila di bawah {AMBANG_STATUS.masaLalu.berat}. Jadi tekanan berat kira-kira sepersepuluh
          tahun terburuk sejak {TAHUN_AWAL}.
        </li>
        <li>
          Lensa target: normal bila skor {AMBANG_STATUS.target.waspada} ke atas (di dalam zona atau
          meleset paling banyak 1 poin persen), perlu waspada bila {AMBANG_STATUS.target.berat} sampai di
          bawah {AMBANG_STATUS.target.waspada}, dan tekanan berat bila di bawah{" "}
          {AMBANG_STATUS.target.berat} (meleset lebih dari 2 poin persen).
        </li>
      </ul>

      <h2 id="pekerja-formal">Pekerja formal dan informal</h2>
      <p>
        Angka pengangguran yang turun belum menunjukkan jenis pekerjaannya. Karena itu, kartu dan halaman
        pengangguran menambahkan porsi pekerja formal dari survei Sakernas BPS.
      </p>
      <ul>
        <li>
          Pekerja formal: berusaha dibantu buruh tetap dan dibayar, serta buruh, karyawan, atau pegawai.
          Selebihnya informal.
        </li>
        <li>Datanya hanya ada untuk ronde Februari dan Agustus.</li>
        <li>Perbandingan hanya antar-ronde bulan yang sama, karena porsinya berbeda menurut bulan survei.</li>
        <li>Yang dibandingkan porsi, bukan jumlah orang, karena jumlah pekerja terus bertambah.</li>
        <li>
          Perubahan porsi di bawah {angka(AMBANG_PORSI, 1)} poin persen ditulis &quot;hampir tidak
          berubah&quot;.
        </li>
      </ul>

      <h2 id="rincian-inflasi">Rincian inflasi</h2>
      <p>
        Halaman inflasi memecah angka umum menjadi tiga kelompok yang dipakai BPS. Penjelasan kelompoknya
        mengikuti{" "}
        <a href="https://www.bi.go.id/id/fungsi-utama/moneter/inflasi/default.aspx">Bank Indonesia</a>, dan
        contoh barangnya dari rilis bulanan BPS dan Bank Indonesia.
      </p>
      <ul>
        {KELOMPOK_INFLASI.map((k) => (
          <li key={k.setahun}>
            <strong>{k.nama}:</strong> {k.isi}
          </li>
        ))}
      </ul>
      <ul>
        <li>
          BPS menerbitkan perubahan bulanan tiap kelompok, tetapi tidak menyediakan tabel perubahan
          setahun per kelompok lewat API. Con-Fore merangkai 12 perubahan bulanan terakhir untuk
          menghitungnya.
        </li>
        <li>
          Perubahan bulanan sudah dibulatkan, jadi hasilnya bisa sedikit berbeda dari angka rilis BPS.
          Untuk inflasi umum, Desember 2024 sampai Oktober 2026, hitungan yang sama berbeda paling jauh
          sekitar 0,02 poin persen dari angka resmi. Karena itu angkanya ditulis dengan satu desimal.
        </li>
        <li>
          Datanya mulai Januari 2024, saat BPS memakai tahun dasar 2022=100. Karena itu angka setahun per
          kelompok baru ada sejak Desember 2024.
        </li>
        <li>Angka kelompok tidak bisa dijumlahkan menjadi angka umum, karena bobot tiap kelompok berbeda.</li>
        <li>
          Barang atau jasa penyumbang terbesar tiap bulan belum ditampilkan, karena datanya tidak tersedia
          lewat API BPS.
        </li>
      </ul>

      <h2 id="perkiraan">Perkiraan</h2>
      <p>
        Tab Prediksi membandingkan beberapa cara meramal, lalu memakai yang paling akurat pada uji dengan data lama.
        Cara yang sederhana boleh menang, dan hasil yang kalah tetap ditampilkan.
      </p>
      <h3>Cara yang dibandingkan</h3>
      <ul>
        <li>
          <strong>Pertumbuhan ekonomi:</strong> sama dengan kuartal terakhir, kembali ke rata-rata (AR), dan model
          faktor (DFM) dari harga komoditas, kurs, BI-Rate, dan inflasi.
        </li>
        <li>
          <strong>Inflasi:</strong> sama dengan bulan terakhir, kembali ke rata-rata (AR), pola musiman dan Lebaran, dan
          ARIMAX yang menambah kurs, harga minyak, dan BI-Rate. Pola musiman meramal perubahan harga bulanan dari lima
          tahun terakhir, lalu merangkainya menjadi inflasi setahun, jadi efek basis tahun lalu ikut terhitung. Bulan
          yang jauh dari polanya, misalnya saat harga BBM naik, dipangkas supaya tidak dianggap pola.
        </li>
        <li>
          <strong>Pengangguran:</strong> sama dengan rilis terakhir, dan regresi dari rilis terakhir, dengan atau tanpa
          pertumbuhan PDB. Perkiraannya hanya dua rilis ke depan dan eksperimental, karena datanya sedikit.
        </li>
      </ul>
      <h3>Cara mengujinya</h3>
      <ul>
        <li>
          Setiap bulan sejak 2012, ramalan dibuat hanya dari data yang sudah terbit saat itu menurut jadwal rilisnya, lalu
          dibandingkan dengan angka yang kemudian terbit.
        </li>
        <li>
          Sebuah model menjadi angka utama hanya bila rata-rata melesetnya lebih kecil dari semua cara sederhana, baik di
          luar masa COVID maupun pada data sejak 2022. Bila tidak, angka utamanya cara sederhana yang paling akurat.
          Penilaian ini per jarak ramalan, jadi cara yang dipakai bisa berbeda antarperiode.
        </li>
        <li>
          Riwayat revisi baru tersimpan sejak Oktober 2026, jadi uji ini memakai angka terbaru, bukan rilis pertama.
          Hasilnya bisa sedikit lebih baik daripada kenyataan. Rekam jejak perkiraan sungguhan dinilai terhadap rilis
          pertama.
        </li>
      </ul>
      <h3>Arti rentang</h3>
      <ul>
        <li>
          Rentang 80% berasal dari seberapa jauh ramalan meleset di luar masa COVID: sekitar 8 dari 10 angka jatuh di
          dalamnya. Jadi rentang ini menggambarkan masa biasa, dan guncangan besar seperti COVID bisa membuat angkanya
          jauh di luar rentang.
        </li>
        <li>Rentang tidak dibuat bila hasil ujinya kurang dari 20.</li>
      </ul>
      <h3>Yang tidak ada di perkiraan</h3>
      <ul>
        <li>Kebijakan baru dan guncangan yang belum terjadi.</li>
        <li>Nasihat keuangan: angkanya menjelaskan arah, bukan menyarankan apa yang perlu dilakukan.</li>
        <li>
          Jangka panjang: di luar dua tahun ke depan, Con-Fore memakai proyeksi IMF, dan target RPJMN hanya dibahas di
          panel jangka panjang.
        </li>
      </ul>

      <h2 id="unduhan">Unduhan</h2>
      <p>
        Setiap angka punya tombol unduh CSV berisi seluruh riwayatnya. Baris-baris awal file berisi
        sumber dan syarat penggunaan yang wajib diikuti bila datanya kamu sebarkan ulang.
      </p>
      </article>
    </div>
  );
}
