// Lapisan penjelas di halaman detail: apa yang diukur, caranya, dan cara membacanya, per jenis seri.
// Bagian "yang bisa diambil" dihitung dari datanya sendiri (lib/riwayat.ts). Teksnya netral (PRD 4.4).

import { KELOMPOK_INFLASI, SERI_FORMAL } from "./konten.ts";

export type Penjelas = { ukur: string; cara: string; baca: string };

const PERTUMBUHAN: Penjelas = {
  ukur: "Seberapa besar nilai barang dan jasa yang dihasilkan di Indonesia berubah dibanding periode yang sama setahun sebelumnya, setelah pengaruh kenaikan harga dikeluarkan. Itu sebabnya disebut PDB riil.",
  cara: "BPS menghitung PDB setiap kuartal, dan angka lama bisa direvisi. Con-Fore menyimpan setiap revisi yang terlihat.",
  baca: "Angka 5% berarti ekonomi 5% lebih besar dibanding setahun sebelumnya. Angka yang turun dari 5% ke 4% berarti pertumbuhannya melambat, bukan ekonominya mengecil. Ekonomi baru mengecil bila angkanya negatif.",
};

const INFLASI: Penjelas = {
  ukur: "Seberapa berubah rata-rata harga barang dan jasa yang dibeli rumah tangga dibanding setahun sebelumnya, dihitung dari Indeks Harga Konsumen.",
  cara: "BPS memantau harga sekumpulan barang dan jasa di banyak kota dan kabupaten, lalu merangkumnya dengan bobot menurut pengeluaran rumah tangga. Tahun dasarnya kini 2022=100.",
  baca: "Inflasi yang turun berarti harga naik lebih lambat, bukan harganya turun. Rata-rata harga baru turun bila angkanya negatif.",
};

const PENGANGGURAN: Penjelas = {
  ukur: "Persentase angkatan kerja yang belum bekerja, antara lain karena sedang mencari kerja, bersiap membuka usaha, atau sudah diterima tetapi belum mulai. Angkatan kerja adalah penduduk usia 15 tahun ke atas yang bekerja atau sedang mencari kerja.",
  cara: "BPS mengukurnya lewat Survei Angkatan Kerja Nasional (Sakernas). Ronde Februari dan Agustus tersedia sejak lama, dan ronde triwulanan sejak 2025.",
  baca: "Bandingkan dengan ronde bulan yang sama tahun lalu, karena angkanya berbeda menurut bulan survei. Orang yang bekerja beberapa jam atau berusaha kecil-kecilan sudah dihitung bekerja, jadi angka ini tidak menunjukkan kualitas pekerjaan.",
};

const KOMODITAS: Penjelas = {
  ukur: "Harga acuan pasar dunia untuk komoditas ini dalam dolar AS, rata-rata per bulan.",
  cara: "Diambil dari data harga komoditas IMF (Primary Commodity Prices), yang biasanya diperbarui pada minggu pertama setiap bulan.",
  baca: "Harganya dalam dolar AS, jadi rupiah yang melemah bisa membuat harga dalam rupiah naik walau harga dolarnya tetap. Pengaruhnya ke Indonesia biasanya baru terasa beberapa bulan kemudian.",
};

const KURS: Penjelas = {
  ukur: "Harga satu mata uang dalam mata uang lain, dari kurs acuan yang diterbitkan Bank Sentral Eropa (ECB) setiap hari kerja.",
  cara: "Kurs rupiah per dolar AS dihitung Con-Fore dengan membagi kurs rupiah per euro dengan kurs dolar per euro, jadi bisa sedikit berbeda dengan kurs Bank Indonesia atau kurs di bank.",
  baca: "Untuk kurs rupiah, angka yang naik berarti rupiah melemah, karena butuh lebih banyak rupiah untuk satu dolar atau satu euro.",
};

const BUNGA: Penjelas = {
  ukur: "Suku bunga kebijakan Bank Indonesia, yang menjadi patokan bunga di perbankan.",
  cara: "Diambil dari kumpulan data suku bunga kebijakan BIS, jadi bisa tertinggal beberapa hari dari keputusan Bank Indonesia.",
  baca: "Perubahan suku bunga acuan biasanya baru terasa ke bunga kredit dan harga setelah beberapa bulan.",
};

const PENDAHULU: Penjelas = {
  ukur: "Indikator komposit dari OECD yang dirancang untuk memberi tanda awal perubahan arah ekonomi.",
  cara: "OECD menerbitkannya setiap bulan dan merevisi riwayatnya, jadi angka lama bisa berubah. Karena itu indikator ini tidak dipakai di model Con-Fore.",
  baca: "Di atas 100 berarti di atas tren jangka panjang. Yang lebih penting arahnya selama beberapa bulan, bukan satu angka.",
};

const PEKERJA: Penjelas = {
  ukur: "Penduduk yang bekerja menurut status pekerjaan utamanya, dari survei Sakernas BPS. Pekerja formal adalah yang berusaha dibantu buruh tetap dan dibayar, serta buruh, karyawan, atau pegawai.",
  cara: "Hanya tersedia untuk ronde Februari dan Agustus. Porsi pekerja formal dihitung Con-Fore dari data itu, dan hasilnya cocok dengan angka rilis BPS untuk lima ronde 2024 sampai 2026.",
  baca: "Bandingkan hanya dengan ronde bulan yang sama, karena porsinya berbeda menurut bulan survei. Porsi lebih berguna daripada jumlah orang, karena jumlah pekerja terus bertambah.",
};

const INFLASI_BULANAN: Penjelas = {
  ukur: "Perubahan rata-rata harga dibanding bulan sebelumnya.",
  cara: "Data resmi BPS dari tabel inflasi umum, inti, harga diatur pemerintah, dan harga bergejolak, sejak Januari 2024 (tahun dasar 2022=100).",
  baca: "Angka bulanan naik turun mengikuti musim, misalnya menjelang Lebaran, jadi lebih mudah dibaca bersama angka setahun.",
};

const INDEKS_HARGA: Penjelas = {
  ukur: "Tingkat rata-rata harga barang dan jasa dibanding tahun dasarnya.",
  cara: "Diambil dari data indeks harga konsumen IMF, yang menyalin data BPS. Dipakai Con-Fore sebagai riwayat panjang untuk model inflasi.",
  baca: "Yang berguna adalah perubahannya, bukan angkanya sendiri. Angka inflasi adalah perubahan indeks ini.",
};

const PDB_NILAI: Penjelas = {
  ukur: "Nilai barang dan jasa yang dihasilkan di Indonesia per kuartal, dalam harga konstan, jadi kenaikan harga sudah dikeluarkan.",
  cara: "Diambil dari data neraca nasional kuartalan IMF, yang menyalin data BPS.",
  baca: "Angkanya naik turun mengikuti musim. Yang lebih sering dipakai adalah pertumbuhannya dibanding kuartal yang sama tahun lalu.",
};

const PER_SERI: Record<string, Penjelas> = {
  bps_gdp_growth_q: PERTUMBUHAN,
  idn_gdp_growth_q: PERTUMBUHAN,
  idn_gdp_growth_a: PERTUMBUHAN,
  idn_gdp_real_q: PDB_NILAI,
  bps_cpi_yoy_m: INFLASI,
  idn_cpi_yoy_m: INFLASI,
  idn_cpi_eop_a: INFLASI,
  bps_cpi_mom_m: INFLASI_BULANAN,
  idn_cpi_index_m: INDEKS_HARGA,
  bps_unemp_round: PENGANGGURAN,
  idn_unemp_a: PENGANGGURAN,
  [SERI_FORMAL]: PEKERJA,
  bps_work_employer_round: PEKERJA,
  bps_work_employee_round: PEKERJA,
  bps_work_total_round: PEKERJA,
  wld_coal_m: KOMODITAS,
  wld_cpo_m: KOMODITAS,
  wld_nickel_m: KOMODITAS,
  wld_brent_m: KOMODITAS,
  usd_idr_d: KURS,
  eur_idr_d: KURS,
  eur_usd_d: KURS,
  idn_policy_rate_m: BUNGA,
  idn_cli_m: PENDAHULU,
  chn_cli_m: PENDAHULU,
};

export function penjelasSeri(seri: string): Penjelas | null {
  const kelompok = KELOMPOK_INFLASI.find((k) => k.setahun === seri || k.sebulan === seri);
  if (!kelompok) return PER_SERI[seri] ?? null;
  const baca = "Angka kelompok tidak bisa dijumlahkan menjadi angka umum, karena bobot tiap kelompok berbeda.";
  if (kelompok.sebulan === seri) {
    return { ukur: `Perubahan harga kelompok ini dibanding bulan sebelumnya. ${kelompok.isi}`, cara: INFLASI_BULANAN.cara, baca };
  }
  return {
    ukur: `Perubahan harga kelompok ini dibanding bulan yang sama setahun sebelumnya. ${kelompok.isi}`,
    cara: "BPS menerbitkan perubahan bulanan tiap kelompok, bukan perubahan setahun. Con-Fore merangkai 12 perubahan bulanan terakhir, jadi hasilnya bisa berbeda sekitar 0,02 poin persen dari angka rilis BPS.",
    baca,
  };
}
