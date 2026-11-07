// Isi tetap situs: seri mana yang tampil di mana, label kejujuran, dan penjelasan "artinya buatmu".

import type { MetaSeri } from "./data";
import { angka } from "./format.ts";

export type KunciKartu = "pertumbuhan" | "inflasi" | "pengangguran";

/**
 * Seri yang mengisi tiga kartu utama, urut prioritas: seri pertama yang ada di latest_values
 * dipakai. Data resmi BPS didahulukan; salinan IMF menjadi cadangan selama seri BPS belum ada
 * atau tidak terbit.
 */
export const SERI_KARTU: Record<KunciKartu, string[]> = {
  pertumbuhan: ["bps_gdp_growth_q", "idn_gdp_growth_q"],
  inflasi: ["bps_cpi_yoy_m", "idn_cpi_yoy_m"],
  pengangguran: ["bps_unemp_round", "idn_unemp_a"],
};

export const JUDUL_KARTU: Record<KunciKartu, string> = {
  pertumbuhan: "Pertumbuhan ekonomi",
  inflasi: "Inflasi",
  pengangguran: "Pengangguran",
};

/** Seri sejenis (termasuk seri BPS yang menyusul) memakai penjelasan yang sama. */
const JENIS_SERI: Record<string, KunciKartu> = {
  idn_gdp_growth_q: "pertumbuhan",
  idn_gdp_growth_a: "pertumbuhan",
  bps_gdp_growth_q: "pertumbuhan",
  idn_cpi_yoy_m: "inflasi",
  idn_cpi_eop_a: "inflasi",
  bps_cpi_yoy_m: "inflasi",
  idn_unemp_a: "pengangguran",
  bps_unemp_round: "pengangguran",
};

/** Konteks pendamping TPT (PRD 4.4). TPT per ronde menjadi pembanding kalimatnya. */
export const SERI_FORMAL = "bps_formal_share_round";
export const SERI_TPT_RONDE = "bps_unemp_round";

/**
 * Rincian inflasi (PRD 4.4): tiga kelompok BPS dengan nama netral, dijelaskan dari isinya.
 * `setahun` dirangkai Con-Fore dari 12 perubahan bulanan; `sebulan` data resmi BPS.
 */
export const KELOMPOK_INFLASI = [
  {
    nama: "Inti",
    setahun: "bps_cpi_core_yoy_m",
    sebulan: "bps_cpi_core_mom_m",
    isi: "Barang dan jasa di luar dua kelompok lain, misalnya biaya sekolah, sepeda motor, telepon seluler, dan emas perhiasan. Sebagai satu kelompok, harganya cenderung bergerak pelan.",
  },
  {
    nama: "Harga diatur pemerintah",
    setahun: "bps_cpi_admin_yoy_m",
    sebulan: "bps_cpi_admin_mom_m",
    isi: "Harga dan tarif yang banyak dipengaruhi kebijakan pemerintah, misalnya bensin, tarif listrik, tarif angkutan, dan rokok.",
  },
  {
    nama: "Harga bergejolak",
    setahun: "bps_cpi_volatile_yoy_m",
    sebulan: "bps_cpi_volatile_mom_m",
    isi: "Sebagian besar bahan makanan yang harganya mudah naik turun, misalnya cabai merah, cabai rawit, dan bawang merah.",
  },
];
export const SERI_INFLASI_BULANAN = "bps_cpi_mom_m";

/** Panel penggerak: kelompok dan urutan seri. Seri yang belum ada di database dilewati. */
export const PENGGERAK: { judul: string; seri: string[] }[] = [
  { judul: "Harga komoditas dunia", seri: ["wld_coal_m", "wld_cpo_m", "wld_nickel_m", "wld_brent_m"] },
  {
    judul: "Rupiah, suku bunga, dan arah ekonomi",
    seri: ["usd_idr_d", "idn_policy_rate_m", "idn_cli_m", "chn_cli_m"],
  },
];

/**
 * Seri yang ditautkan dari beranda. Halaman dan CSV-nya selalu dibangun saat build, walau datanya
 * belum ada, supaya tautannya hidup begitu pipeline menerbitkan seri itu dan memanggil revalidasi.
 */
export const SERI_DITAUTKAN: string[] = [
  ...Object.values(SERI_KARTU).flat(),
  ...PENGGERAK.flatMap((k) => k.seri),
  SERI_FORMAL,
  ...KELOMPOK_INFLASI.map((k) => k.setahun),
];

/** Kelompok untuk letak halaman dan tautan antarseri di halaman detail: [seri, nama singkat]. */
const KELOMPOK_HALAMAN: { judul: string; seri: [string, string][] }[] = [
  {
    judul: "Tiga angka utama",
    seri: [
      ["bps_gdp_growth_q", "Pertumbuhan"],
      ["bps_cpi_yoy_m", "Inflasi"],
      ["bps_unemp_round", "Pengangguran"],
    ],
  },
  {
    judul: "Rincian inflasi",
    seri: [
      ["bps_cpi_yoy_m", "Umum"],
      ["bps_cpi_core_yoy_m", "Inti"],
      ["bps_cpi_admin_yoy_m", "Harga diatur pemerintah"],
      ["bps_cpi_volatile_yoy_m", "Harga bergejolak"],
    ],
  },
  {
    judul: PENGGERAK[0].judul,
    seri: [
      ["wld_coal_m", "Batu bara"],
      ["wld_cpo_m", "CPO"],
      ["wld_nickel_m", "Nikel"],
      ["wld_brent_m", "Brent"],
    ],
  },
  {
    judul: PENGGERAK[1].judul,
    seri: [
      ["usd_idr_d", "Kurs rupiah"],
      ["idn_policy_rate_m", "BI-Rate"],
      ["idn_cli_m", "Pendahulu Indonesia"],
      ["chn_cli_m", "Pendahulu Tiongkok"],
    ],
  },
  {
    judul: "Pasar kerja",
    seri: [
      ["bps_unemp_round", "Pengangguran"],
      [SERI_FORMAL, "Pekerja formal"],
    ],
  },
];

export function kelompokHalaman(seri: string) {
  return KELOMPOK_HALAMAN.find((k) => k.seri.some(([id]) => id === seri));
}

export const NAMA_FREKUENSI: Record<string, string> = {
  A: "Tahunan",
  Q: "Kuartalan",
  M: "Bulanan",
  D: "Harian",
  ronde: "Per ronde survei",
};

const ARTINYA_PENGGERAK: Record<string, string> = {
  wld_coal_m:
    "Batu bara termasuk ekspor terbesar Indonesia. Harga yang tinggi menambah devisa dan penerimaan negara; harga yang jatuh mengurangi keduanya.",
  wld_cpo_m:
    "Indonesia produsen minyak sawit terbesar di dunia. Harga CPO memengaruhi pendapatan petani sawit dan harga minyak goreng di pasar.",
  wld_nickel_m:
    "Nikel adalah bahan baterai dan baja tahan karat, dan Indonesia pemasok utamanya. Harganya memengaruhi ekspor hasil tambang olahan dan minat investasi smelter.",
  wld_brent_m:
    "Harga minyak dunia memengaruhi biaya energi, beban subsidi BBM, dan ongkos angkut barang, yang pada akhirnya ikut ke harga di toko.",
  usd_idr_d:
    "Angka yang naik berarti rupiah melemah: barang impor, kuliah, dan liburan ke luar negeri jadi lebih mahal, tetapi eksportir mendapat rupiah lebih banyak.",
  idn_policy_rate_m:
    "Suku bunga acuan Bank Indonesia ikut menentukan bunga kredit dan tabungan. Bila naik, cicilan cenderung naik; bila turun, meminjam lebih murah.",
  idn_cli_m:
    "Indikator ini memberi gambaran arah ekonomi beberapa bulan ke depan. Di atas 100 berarti di atas tren jangka panjang; angka yang terus turun memberi tanda perlambatan.",
  chn_cli_m:
    "Tiongkok adalah mitra dagang terbesar Indonesia. Bila ekonominya melambat, permintaan atas batu bara, sawit, dan nikel kita bisa ikut turun.",
};

/** "2,6% lebih mahal dibanding setahun sebelumnya", dari angka yang tampil. */
function gerakHarga(nilai: number, desimal: number, pembanding: string, awalan = ""): string {
  const tampil = Number(nilai.toFixed(desimal));
  if (tampil === 0) return `hampir sama dengan ${pembanding}`;
  return `${awalan}${angka(Math.abs(tampil), desimal)}% ${tampil > 0 ? "lebih mahal" : "lebih murah"} dibanding ${pembanding}`;
}

/** Penjelasan sehari-hari untuk satu nilai, atau null bila belum ada penjelasan untuk seri itu. */
export function artinyaBuatmu(seri: string, nilai: number): string | null {
  const kelompok = KELOMPOK_INFLASI.find((k) => k.setahun === seri || k.sebulan === seri);
  if (kelompok) {
    const gerak =
      kelompok.setahun === seri
        ? gerakHarga(nilai, 1, "setahun sebelumnya", "sekitar ")
        : gerakHarga(nilai, 2, "bulan sebelumnya");
    return `Harga kelompok ini ${gerak}. ${kelompok.isi}`;
  }
  if (seri === SERI_INFLASI_BULANAN) {
    return `Rata-rata harga barang dan jasa ${gerakHarga(nilai, 2, "bulan sebelumnya")}.`;
  }
  const jenis = JENIS_SERI[seri];
  if (jenis === "pertumbuhan") {
    const arah = nilai >= 0 ? "lebih besar" : "lebih kecil";
    return `Nilai barang dan jasa yang dihasilkan di Indonesia ${angka(Math.abs(nilai), 1)}% ${arah} dibanding periode yang sama setahun sebelumnya. Pertumbuhan yang melambat biasanya membuat lapangan kerja baru dan kenaikan penghasilan lebih sulit didapat.`;
  }
  if (jenis === "inflasi") {
    const arah = nilai >= 0 ? "lebih mahal" : "lebih murah";
    return `Rata-rata harga barang dan jasa ${angka(Math.abs(nilai), 1)}% ${arah} dibanding setahun sebelumnya. Kalau penghasilanmu naik kurang dari itu dalam setahun, daya belimu turun.`;
  }
  if (jenis === "pengangguran") {
    return `Dari setiap 100 orang angkatan kerja (yang bekerja atau sedang mencari kerja), sekitar ${angka(nilai, 0)} belum mendapat pekerjaan. Makin rendah angkanya, makin mudah orang mendapat kerja.`;
  }
  if (seri === SERI_FORMAL) {
    return `Dari setiap 100 orang yang bekerja, sekitar ${angka(nilai, 0)} adalah pekerja formal: pengusaha dengan buruh tetap, atau buruh, karyawan, dan pegawai. Sisanya pekerja informal, misalnya berusaha sendiri atau pekerja lepas.`;
  }
  return ARTINYA_PENGGERAK[seri] ?? null;
}

const NAMA_PENDEK: Record<string, string> = {
  imf: "IMF",
  bis: "BIS",
  oecd: "OECD",
  ecb: "ECB",
  bps: "BPS",
};

export function namaPendek(sumber: string): string {
  return NAMA_PENDEK[sumber] ?? sumber.toUpperCase();
}

/**
 * Label kejujuran per seri. "data resmi" hanya untuk seri yang diambil langsung dari BPS; angka
 * Indonesia dari IMF ditandai sebagai salinan, dan olahan Con-Fore selalu disebut.
 */
/** Seri proyeksi IMF untuk tab Prediksi: memuat tahun yang belum terjadi, jadi tidak punya halaman detail. */
export const adalahProyeksi = (seri: string) => seri.endsWith("_weo_a");

export function labelSeri(m: MetaSeri): string {
  if (adalahProyeksi(m.series_id)) return "proyeksi IMF";
  const olahan = /^(dihitung|kurs silang dihitung)/i.test(m.citation);
  if (m.source_id === "bps") return olahan ? "dihitung Con-Fore dari data resmi BPS" : "data resmi BPS";
  if (m.source_id === "imf" && m.country === "IDN") {
    return olahan ? "dihitung Con-Fore dari salinan IMF atas data BPS" : "salinan IMF dari data BPS";
  }
  return olahan ? `dihitung Con-Fore dari data ${namaPendek(m.source_id)}` : `data ${namaPendek(m.source_id)}`;
}

export const NAMA_KALENDER: Record<string, string> = {
  bps: "jadwal rilis BPS",
  "bps-perkiraan": "perkiraan dari pola rilis BPS, jadwal resminya belum terbit",
  oecd: "jadwal rilis OECD",
  "bi-rdg": "jadwal Rapat Dewan Gubernur BI",
};

/**
 * Keterangan tanggal rilis berikutnya: jadwal siapa, dan apakah angka di sini baru menyusul
 * (SCHEMA 2.2). Contoh: salinan IMF atas data BPS terbit beberapa minggu setelah tanggal BPS.
 */
export function keteranganJadwal(m: MetaSeri, kalender: string | undefined): string {
  const nama = kalender ? (NAMA_KALENDER[kalender] ?? `jadwal ${kalender}`) : "perkiraan jadwal";
  if (m.source_id === "imf" && m.country === "IDN") {
    return `${nama}; angka di sini menyusul lewat salinan IMF`;
  }
  if (kalender && kalender.replace(/-perkiraan$/, "") !== m.source_id) {
    return `${nama}; angka di sini menyusul lewat data ${namaPendek(m.source_id)}`;
  }
  return nama;
}

export const NAMA_TARGET: Record<string, string> = {
  apbn: "UU APBN",
  pmk: "PMK sasaran inflasi",
  rpjmn: "RPJMN",
};

export const STATUS_VERIFIKASI: Record<string, string> = {
  dokumen: "dicocokkan ke dokumen",
  berita: "dari pemberitaan, belum dicocokkan ke dokumen",
};
