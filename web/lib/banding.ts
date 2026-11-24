// Isi halaman Banding (PRD 4.1): negara pembanding, baris tabel, kalimat, dan definisi pengangguran tiap negara.
// Fungsi murni tanpa waktu sekarang, dites di banding.test.ts. Angkanya sudah dibulatkan seperti yang tampil, supaya
// kalimat, grafik, dan tabel selalu cocok.

import type { MetaSeri, Titik } from "./data";
import { angka, angkaTampil, tanggal } from "./format.ts";
import { terbaru } from "./jsonld.ts";
import { adalahProyeksi, type KunciKartu, type KunciTopik } from "./konten.ts";
import { TARGET_PREDIKSI, persen, type NilaiTahun } from "./prediksi.ts";

/** Desimal semua angka di halaman ini, supaya kedua negara ditulis sama teliti. */
export const DESIMAL = 1;

export type KunciNegara = "malaysia" | "thailand" | "filipina" | "vietnam";

/** `kunci` juga menjadi alamat halamannya: /banding/malaysia. `awalan` mengawali id serinya: mys_cpi_eop_weo_a. */
export type Negara = { kunci: KunciNegara; nama: string; awalan: string };

export const NEGARA_BANDING: Negara[] = [
  { kunci: "malaysia", nama: "Malaysia", awalan: "mys" },
  { kunci: "thailand", nama: "Thailand", awalan: "tha" },
  { kunci: "filipina", nama: "Filipina", awalan: "phl" },
  { kunci: "vietnam", nama: "Vietnam", awalan: "vnm" },
];

export const AWALAN_INDONESIA = "idn";

/** Tujuan tautan menu: negara pertama, sama dengan pengalihan /banding di next.config.ts. */
export const ALAMAT_BANDING = `/banding/${NEGARA_BANDING[0].kunci}`;

export const negaraDari = (kunci: string): Negara | undefined => NEGARA_BANDING.find((n) => n.kunci === kunci);

/** Id seri proyeksi IMF satu angka, misalnya seriProyeksi("inflasi", "mys") menjadi "mys_cpi_eop_weo_a". */
export function seriProyeksi(kartu: KunciKartu, awalan: string): string {
  return TARGET_PREDIKSI.find((t) => t.kunci === kartu)!.imf.replace(/^idn/, awalan);
}

/**
 * Tanggal terbit edisi IMF tiap seri. Seri yang pengambilan terakhirnya berhasil memuat edisi yang sama, jadi
 * tanggalnya yang paling baru di antara mereka, karena seri yang angkanya tidak berubah menyimpan tanggal edisi
 * sebelumnya (SCHEMA 2.2). Seri yang gagal diambil (`basi`) bisa masih edisi lama, jadi memakai tanggalnya sendiri.
 */
export function terbitProyeksi(meta: MetaSeri[], basi: Set<string>): Map<string, string> {
  const proyeksi = meta.filter((m) => adalahProyeksi(m.series_id));
  const edisi = terbaru(proyeksi.filter((m) => !basi.has(m.series_id)).map((m) => m.last_release_date));
  const hasil = new Map<string, string>();
  for (const m of proyeksi) {
    const terbit = basi.has(m.series_id) ? m.last_release_date : edisi;
    if (terbit) hasil.set(m.series_id, terbit);
  }
  return hasil;
}

/** Label tanggal terbit. Kedua negara bisa berbeda edisi selama salah satunya gagal diambil. */
export function labelTerbit(negara: string, indonesia: string, lain: string): string {
  return indonesia === lain
    ? `Proyeksi IMF, terbit ${tanggal(indonesia)}`
    : `Proyeksi IMF, terbit ${tanggal(indonesia)} untuk Indonesia dan ${tanggal(lain)} untuk ${negara}`;
}

export type IsiBanding = {
  /** Nama angkanya di bawah judul kartu. */
  nama: string;
  /** Sebutannya di dalam kalimat. */
  subjek: string;
  /** Kunci membaca angka minus, hanya tampil bila ada angka minus. */
  minus: string;
  /** Keterangan baris perkiraan Con-Fore, ditutup tanggal hitungnya. */
  conFore: string;
  /** Pengganti keterangan itu bila tidak ada tahun yang diramal Con-Fore. */
  tanpaConFore: string;
};

export const ISI_BANDING: Record<KunciTopik, IsiBanding> = {
  harga: {
    nama: "Inflasi akhir tahun, dibanding akhir tahun sebelumnya",
    subjek: "inflasi",
    minus: "Angka minus berarti harga turun dibanding setahun sebelumnya.",
    conFore: "Perkiraan Con-Fore di tabel ini untuk inflasi Desember di Indonesia, dan bukan angka resmi",
    tanpaConFore: "Perkiraan Con-Fore untuk inflasi Desember belum tersedia.",
  },
  kerja: {
    nama: "Tingkat pengangguran, persen dari angkatan kerja",
    subjek: "pengangguran",
    minus: "",
    conFore: "Perkiraan Con-Fore di tabel ini untuk survei Agustus di Indonesia, dan bukan angka resmi",
    tanpaConFore: "Perkiraan Con-Fore belum ada di tabel ini, karena survei Agustus berikutnya di Indonesia belum diramal.",
  },
  ekonomi: {
    nama: "Pertumbuhan ekonomi, dibanding tahun sebelumnya",
    subjek: "pertumbuhan",
    minus: "Angka minus berarti ekonomi menyusut dibanding tahun sebelumnya.",
    conFore:
      "Perkiraan Con-Fore di tabel ini untuk Indonesia, dan bukan angka resmi. Isinya rata-rata empat kuartal dengan angka resmi untuk kuartal yang sudah terbit, dan rentangnya hanya dihitung per kuartal",
    tanpaConFore: "Perkiraan Con-Fore untuk setahun penuh belum tersedia.",
  },
};

export type BarisBanding = { tahun: number; indonesia: number; lain: number; conFore: number | null };

/**
 * Tahun yang diproyeksikan IMF untuk kedua negara, mulai tahun terbit edisinya, dengan perkiraan Con-Fore untuk
 * Indonesia di tahun yang angka resminya belum terbit.
 */
export function barisBanding(
  indonesia: Titik[],
  lain: Titik[],
  mulai: number,
  kartu: KunciKartu,
  perTahun: Map<number, NilaiTahun>,
): BarisBanding[] {
  const nilaiLain = new Map(lain);
  return indonesia.flatMap(([periode, nilai]) => {
    const tahun = Number(periode);
    const pasangan = nilaiLain.get(periode);
    if (tahun < mulai || pasangan == null) return [];
    const perkiraan = perTahun.get(tahun)?.[kartu];
    return [
      {
        tahun,
        indonesia: angkaTampil(nilai, DESIMAL),
        lain: angkaTampil(pasangan, DESIMAL),
        conFore: perkiraan && !perkiraan.resmi ? angkaTampil(perkiraan.nilai, DESIMAL) : null,
      },
    ];
  });
}

const selisih = (b: BarisBanding) => `selisih ${angka(Math.abs(b.indonesia - b.lain), DESIMAL)} poin persen`;

/** Kalimat kartu: angka tahun pertama dan tahun terakhir beserta selisihnya, tanpa vonis (PRD 4.4). */
export function kalimatBanding(subjek: string, negara: string, baris: BarisBanding[]): string {
  const awal = baris[0];
  const akhir = baris[baris.length - 1];
  const i = persen(awal.indonesia, DESIMAL);
  const kalimat =
    awal.indonesia === awal.lain
      ? `Menurut proyeksi IMF, ${subjek} ${awal.tahun} di Indonesia dan ${negara} sama-sama ${i}.`
      : `Menurut proyeksi IMF, ${subjek} ${awal.tahun} di Indonesia ${i} dan di ${negara} ${persen(awal.lain, DESIMAL)}, ${selisih(awal)}.`;
  if (akhir === awal) return kalimat;
  const j = persen(akhir.indonesia, DESIMAL);
  return akhir.indonesia === akhir.lain
    ? `${kalimat} Untuk ${akhir.tahun}, keduanya ${j}.`
    : `${kalimat} Untuk ${akhir.tahun}, Indonesia ${j} dan ${negara} ${persen(akhir.lain, DESIMAL)}, ${selisih(akhir)}.`;
}

/** Isi grafik dalam kata, untuk pembaca layar. */
export function teksGrafikBanding(nama: string, negara: string, baris: BarisBanding[]): string {
  const awal = baris[0];
  const akhir = baris[baris.length - 1];
  const gerak = (dari: number, ke: number) => `dari ${persen(dari, DESIMAL)} ke ${persen(ke, DESIMAL)}`;
  return (
    `Grafik proyeksi IMF, ${awal.tahun} sampai ${akhir.tahun}. ${nama}. ` +
    `Indonesia ${gerak(awal.indonesia, akhir.indonesia)}, ${negara} ${gerak(awal.lain, akhir.lain)}.`
  );
}

/**
 * Perbedaan definisi, di kartu Kerja. Definisi yang dipakai IMF dibaca dari atribut LABOR_SECTOR_EMPLOYMENT_TYPE
 * seri LUR di API WEO pada 2026-11-24: "Harmonized ILO definition" untuk Filipina, "National definition" untuk
 * empat negara lain.
 */
export function kalimatDefinisi(negara: Negara): string {
  const milikIMF =
    negara.kunci === "filipina"
      ? "IMF memakai definisi nasional untuk Indonesia dan definisi Organisasi Perburuhan Internasional (ILO) untuk Filipina."
      : "IMF memakai definisi masing-masing negara.";
  return `Penganggur di Indonesia dan ${negara.nama} tidak dihitung dengan cara yang sama. ${milikIMF} Jadi selisihnya perlu dibaca hati-hati.`;
}

export type Definisi = { isi: string; sumber: string; url: string };

/** Definisi ILO, yang dipakai IMF untuk Filipina. Dibaca di sumbernya pada 2026-11-24. */
export const DEFINISI_ILO: Definisi = {
  isi:
    "usia kerja yang tidak bekerja, siap bekerja, dan mencari kerja. Yang tidak mencari tetapi sudah punya janji mulai bekerja juga dihitung.",
  sumber: "Bank Dunia, metadata pengangguran dari data ILO",
  url: "https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SL.UEM.TOTL.ZS",
};

/** Siapa yang dihitung menganggur menurut kantor statistik tiap negara, dibaca di sumbernya pada 2026-11-24. */
export const DEFINISI: Record<"indonesia" | KunciNegara, Definisi> = {
  indonesia: {
    isi:
      "umur 15 tahun ke atas yang tidak punya pekerjaan dan sedang mencari kerja, sedang menyiapkan usaha, atau tidak mencari karena merasa tidak mungkin mendapatkannya. Yang sudah punya pekerjaan tetapi belum mulai juga dihitung.",
    sumber: "BPS, Keadaan Angkatan Kerja di Indonesia Agustus 2025",
    url: "https://www.bps.go.id/id/publication/2025/12/19/42a75ee61332755586fdfcdd/keadaan-angkatan-kerja-di-indonesia-agustus-2025.html",
  },
  malaysia: {
    isi:
      "umur 15 sampai 64 tahun yang tidak bekerja pada minggu survei, siap bekerja, dan mencari kerja. Yang tidak mencari juga dihitung bila mengira tidak ada pekerjaan, merasa tidak memenuhi syarat, sakit sementara, terhalang cuaca, atau menunggu hasil lamaran.",
    sumber: "Departemen Statistik Malaysia (DOSM), lewat IMF DSBB",
    url: "https://dsbb.imf.org/sdds/dqaf-base/country/MYS/category/UEM00",
  },
  thailand: {
    isi:
      "umur 15 tahun ke atas yang tidak bekerja pada minggu survei dan tidak punya pekerjaan, lalu mencari kerja, melamar, atau menunggu panggilan dalam 30 hari terakhir. Yang tidak mencari tetapi siap bekerja juga dihitung. Pekerja keluarga yang menunggu musim tidak dihitung.",
    sumber: "Kantor Statistik Nasional Thailand (NSO), lewat IMF DSBB",
    url: "https://dsbb.imf.org/sdds/dqaf-base/country/THA/category/UEM00",
  },
  filipina: {
    isi:
      "umur 15 tahun ke atas yang tidak punya pekerjaan atau usaha, siap bekerja sekarang atau dalam dua minggu, dan mencari kerja. Yang tidak mencari juga dihitung bila mengira tidak ada pekerjaan, menunggu hasil lamaran, sakit sementara, terhalang cuaca, atau menunggu dipanggil bekerja lagi.",
    sumber: "Otoritas Statistik Filipina (PSA), lewat IMF DSBB",
    url: "https://dsbb.imf.org/sdds/dqaf-base/country/PHL/category/UEM00",
  },
  vietnam: {
    isi:
      "yang tidak bekerja, mencari kerja, dan siap bekerja. Yang pada minggu survei tidak mencari karena sakit sementara, cuaca, libur, menunggu hasil lamaran, atau menunggu mulai kerja juga dihitung. Angka utamanya hanya untuk usia kerja, yaitu pada 2024 laki-laki 15 sampai di bawah 61 tahun dan perempuan 15 sampai di bawah 56 tahun 4 bulan.",
    sumber: "Kantor Statistik Nasional Vietnam (NSO), Report on Labour Force Survey 2024",
    url: "https://www.nso.gov.vn/wp-content/uploads/2026/05/01-Sach-Bao-cao-lao-dong-viec-lam-2024-tieng-Anh_up-web.pdf",
  },
};

/** Definisi yang tampil di kotak penjelas. Untuk Filipina, definisi di balik angkanya ditulis sebelum definisi nasional. */
export function daftarDefinisi(negara: Negara): (Definisi & { nama: string })[] {
  const nasional = { nama: negara.nama, ...DEFINISI[negara.kunci] };
  return [
    { nama: "Indonesia", ...DEFINISI.indonesia },
    ...(negara.kunci === "filipina"
      ? [
          { ...DEFINISI_ILO, nama: "Filipina, definisi ILO yang dipakai IMF" },
          { ...nasional, nama: "Filipina, definisi nasional" },
        ]
      : [nasional]),
  ];
}
