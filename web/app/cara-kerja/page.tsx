// Cara kerja: data, pembaruan, label, dan aturan skor segitiga dalam bahasa sehari-hari.

import type { Metadata } from "next";
import Link from "next/link";
import { PATOKAN_INFLASI, POIN_PER_PP, TAHUN_AKHIR, TAHUN_AWAL } from "@/lib/skor";

export const metadata: Metadata = {
  title: "Cara kerja",
  description: "Dari mana angka Con-Fore berasal, kapan diperbarui, dan bagaimana skor segitiga dihitung.",
};

export default function CaraKerja() {
  return (
    <article className="prosa">
      <section className="pembuka">
        <h1>Cara kerja</h1>
        <p>
          Con-Fore merangkum ekonomi Indonesia lewat tiga angka: pertumbuhan ekonomi, inflasi, dan
          pengangguran. Halaman ini menjelaskan dari mana angkanya, kapan diperbarui, dan cara
          menghitung skor segitiga.
        </p>
      </section>

      <h2>Dari mana angkanya</h2>
      <ul>
        <li>
          Setiap pagi sebuah program otomatis mengambil data publik dari lembaga sumber (IMF, BIS,
          OECD, ECB, dan BPS bila sudah tersedia), lalu menyimpannya. Situs ini hanya membaca hasil
          olahan itu. Daftar lengkapnya ada di <Link href="/sumber">Sumber data</Link>.
        </li>
        <li>
          Angka Indonesia diambil langsung dari BPS bila sudah tersedia. Bila belum, dipakai salinan IMF
          dari data BPS, yang biasanya terbit beberapa minggu setelah rilis BPS. Label di setiap angka
          menyebut mana yang dipakai.
        </li>
        <li>
          Setiap angka mencantumkan sumber, periode, dan tanggal Con-Fore melihatnya. Bila pembaruan
          gagal lebih dari 36 jam, halaman menampilkan peringatan.
        </li>
      </ul>

      <h2>Arti label</h2>
      <ul>
        <li>
          <strong>data resmi BPS</strong>: diambil langsung dari BPS.
        </li>
        <li>
          <strong>salinan IMF dari data BPS</strong>: angka BPS yang diterbitkan ulang oleh IMF.
        </li>
        <li>
          <strong>dihitung Con-Fore</strong>: olahan Con-Fore dari data sumber, misalnya pertumbuhan
          dibanding tahun lalu yang dihitung dari PDB riil, atau kurs rupiah per dolar dari dua kurs
          acuan ECB.
        </li>
        <li>
          <strong>data IMF, BIS, OECD, ECB</strong>: data lembaga itu apa adanya.
        </li>
      </ul>
      <p>Tab Data tidak memuat ramalan. Perkiraan akan tampil di tab Prediksi, dengan label sendiri.</p>

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

      <h2>Unduhan</h2>
      <p>
        Setiap angka punya tombol unduh CSV berisi seluruh riwayatnya. Baris-baris awal file berisi
        sumber dan syarat penggunaan yang wajib diikuti bila datanya kamu sebarkan ulang.
      </p>
    </article>
  );
}
