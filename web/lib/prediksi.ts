// Isi tab Prediksi (PRD 4.1): angka utama, angka tahunan untuk segitiga, dan kalimat penjelasnya.
// Fungsi murni tanpa waktu sekarang, dites di prediksi.test.ts.

import type { BarisRamalan, SkorBacktest, Target, Titik } from "./data";
import { angka, periode } from "./format.ts";
import type { KunciKartu } from "./konten.ts";
import type { NilaiTahun } from "./skor.ts";

export type TargetPrediksi = {
  kunci: KunciKartu;
  seri: string;
  /** Seri proyeksi IMF untuk konsep tahunan yang sepadan. */
  imf: string;
  judul: string;
  /** Sama dengan jumlah desimal angka resminya di tab Data. */
  desimal: number;
  namaHorizon: (h: number) => string;
  /** Horizon yang ditampilkan di tabel rekam jejak. */
  horizonRekam: number[];
};

export const TARGET_PREDIKSI: TargetPrediksi[] = [
  {
    kunci: "pertumbuhan",
    seri: "bps_gdp_growth_q",
    imf: "idn_gdp_growth_weo_a",
    judul: "Pertumbuhan ekonomi",
    desimal: 1,
    namaHorizon: (h) => `${h} kuartal`,
    horizonRekam: [1, 2, 4, 6],
  },
  {
    kunci: "inflasi",
    seri: "bps_cpi_yoy_m",
    imf: "idn_cpi_eop_weo_a",
    judul: "Inflasi",
    desimal: 1,
    namaHorizon: (h) => `${h} bulan`,
    horizonRekam: [1, 3, 6, 12, 18],
  },
  {
    kunci: "pengangguran",
    seri: "bps_unemp_round",
    imf: "idn_unemp_weo_a",
    judul: "Pengangguran",
    desimal: 2,
    namaHorizon: (h) => `${h} bulan`,
    horizonRekam: [6, 12],
  },
];

/** Seri perubahan bulanan untuk menjelaskan efek basis inflasi. */
export const SERI_BULANAN = "bps_cpi_mom_m";
export const SERI_PDB_TAHUNAN = "idn_gdp_growth_a";

export const NAMA_MODEL: Record<string, string> = {
  sama_terakhir: "Sama dengan angka terakhir",
  ar1: "Kembali ke rata-rata (AR)",
  dfm: "Model faktor (DFM)",
  musiman: "Pola musiman dan Lebaran",
  arimax: "ARIMAX",
  regresi: "Regresi dari rilis terakhir",
  regresi_pdb: "Regresi dengan PDB",
};

const CARA_MODEL: Record<string, string> = {
  sama_terakhir: "Cara ini menganggap angka berikutnya sama dengan angka resmi terakhir.",
  ar1: "Cara ini menganggap angka berikutnya bergerak perlahan ke rata-ratanya.",
  dfm: "Cara ini menggabungkan gerak harga komoditas, kurs, BI-Rate, dan inflasi dalam satu model.",
  musiman:
    "Cara ini meramal perubahan harga bulanan dari pola bulan kalender lima tahun terakhir, Ramadan, dan Lebaran, lalu merangkainya menjadi inflasi setahun.",
  arimax: "Cara ini memakai pola musiman ditambah perubahan kurs, harga minyak, dan BI-Rate.",
  regresi: "Cara ini meramal angka berikutnya dari rilis terakhir dan bulan surveinya.",
  regresi_pdb: "Cara ini meramal angka berikutnya dari rilis terakhir, bulan surveinya, dan pertumbuhan PDB.",
};

/** Satu baris per periode: angka utama target itu, terurut menurut periode. */
export function jalurUtama(baris: BarisRamalan[], seri: string): BarisRamalan[] {
  return baris
    .filter((b) => b.series_id === seri && b.is_main)
    .sort((a, b) => a.ref_period.localeCompare(b.ref_period));
}

export function persen(n: number, desimal: number): string {
  return `${angka(n, desimal)}%`;
}

/** "2,7% sampai 3,8%", atau null bila backtest belum cukup untuk membuat rentang. */
export function teksRentang(bawah: number | null, atas: number | null, desimal: number): string | null {
  return bawah == null || atas == null ? null : `${persen(bawah, desimal)} sampai ${persen(atas, desimal)}`;
}

/**
 * Tahun segitiga perkiraan: tahun dari kuartal IV PDB pertama yang belum terbit, karena angka itulah yang
 * paling akhir terbit dalam satu tahun.
 */
export function tahunPerkiraan(jalurPdb: BarisRamalan[]): number | null {
  const q4 = jalurPdb.find((b) => b.ref_period.endsWith("-Q4"));
  return q4 ? Number(q4.ref_period.slice(0, 4)) : null;
}

/** Angka resmi periode itu, atau angka utama perkiraannya. */
function resmiAtauRamalan(p: string, resmi: Titik[], jalur: BarisRamalan[]): number | null {
  return resmi.find((t) => t[0] === p)?.[1] ?? jalur.find((b) => b.ref_period === p)?.point ?? null;
}

/**
 * Angka tahunan seperti pada segitiga. Pertumbuhan dari rata-rata y-on-y empat kuartal (2025: 5,105,
 * resminya 5,11), inflasi dari Desember, dan TPT dari ronde Agustus. Ronde Agustus yang belum bisa
 * diramal memakai angka utama TPT yang terakhir, karena perkiraannya hanya dua rilis ke depan.
 */
export function nilaiTahunPerkiraan(
  tahun: number,
  resmi: { pdb: Titik[]; inflasi: Titik[]; tpt: Titik[] },
  jalur: { pdb: BarisRamalan[]; inflasi: BarisRamalan[]; tpt: BarisRamalan[] },
): NilaiTahun | null {
  const kuartal = [1, 2, 3, 4].map((q) => resmiAtauRamalan(`${tahun}-Q${q}`, resmi.pdb, jalur.pdb));
  const inflasi = resmiAtauRamalan(`${tahun}-12`, resmi.inflasi, jalur.inflasi);
  const pengangguran =
    resmiAtauRamalan(`${tahun}-08`, resmi.tpt, jalur.tpt) ?? jalur.tpt[jalur.tpt.length - 1]?.point ?? null;
  if (kuartal.some((k) => k == null) || inflasi == null || pengangguran == null) return null;
  const pertumbuhan = (kuartal as number[]).reduce((a, b) => a + b, 0) / 4;
  return { pertumbuhan, inflasi, pengangguran };
}

/** Rata-rata meleset satu model pada satu horizon dan jendela, null bila belum ada. */
export function maeModel(
  skor: SkorBacktest[],
  seri: string,
  model: string,
  horizon: number,
  jendela: SkorBacktest["window_name"] = "normal",
): number | null {
  return (
    skor.find(
      (s) => s.series_id === seri && s.model === model && s.horizon === horizon && s.window_name === jendela,
    )?.mae ?? null
  );
}

/** Model yang punya skor pada seri itu: angka utama dulu, sisanya menurut MAE terkecil pada horizon itu. */
export function modelTerurut(skor: SkorBacktest[], seri: string, horizon: number, utama: string): string[] {
  const nilai = skor.filter((s) => s.series_id === seri && s.horizon === horizon && s.window_name === "normal");
  return nilai
    .slice()
    .sort((a, b) => (a.model === utama ? -1 : b.model === utama ? 1 : a.mae - b.mae))
    .map((s) => s.model);
}

/** Sama dengan MIN_ERRORS di pipeline: di bawah ini, sebuah model tidak bisa menjadi angka utama. */
const UJI_CUKUP = 20;

/**
 * Kenapa perkiraannya begini: cara yang dipakai, seberapa jauh rata-rata melesetnya, dan pembandingnya
 * pada uji data lama. Horizon yang dipakai adalah yang pertama dengan cukup uji, atau yang paling banyak
 * ujinya, supaya angkanya tidak bertumpu pada segelintir kejadian. Tidak mengarang penggerak: bila angka
 * utamanya cara sederhana, kalimatnya mengatakan itu.
 */
export function kalimatCara(
  target: TargetPrediksi,
  jalur: BarisRamalan[],
  skor: SkorBacktest[],
): string[] {
  const utama = jalur[0]?.model;
  if (!utama) return [];
  const kalimat = [CARA_MODEL[utama] ?? ""];
  const milik = skor
    .filter((s) => s.series_id === target.seri && s.model === utama && s.window_name === "normal")
    .sort((a, b) => a.horizon - b.horizon);
  const dipakai = milik.find((s) => s.n >= UJI_CUKUP) ?? [...milik].sort((a, b) => b.n - a.n)[0];
  if (dipakai) {
    const banding = modelTerurut(skor, target.seri, dipakai.horizon, utama)
      .filter((m) => m !== utama)
      .map((m) => ({ model: m, mae: maeModel(skor, target.seri, m, dipakai.horizon)! }));
    const lain = banding.map((b) => `${NAMA_MODEL[b.model] ?? b.model} ${angka(b.mae, 2)}`);
    kalimat.push(
      `Pada uji dengan data lama di luar masa COVID, untuk ${target.namaHorizon(dipakai.horizon)} ke depan, cara ini rata-rata meleset ${angka(dipakai.mae, 2)} poin persen` +
        (dipakai.n < UJI_CUKUP ? ` (baru ${dipakai.n} kali uji).` : ".") +
        (lain.length ? ` Pembandingnya: ${lain.join(", ")}.` : ""),
    );
    if (banding.some((b) => b.mae < dipakai.mae)) {
      kalimat.push(
        `Cara yang lebih kecil di sini belum dipakai, karena harus menang juga pada data sejak 2022, dengan minimal ${UJI_CUKUP} kali uji.`,
      );
    }
  }
  if (new Set(jalur.map((b) => b.model)).size > 1) {
    kalimat.push("Cara yang dipakai berbeda antarperiode, mengikuti hasil uji tiap jarak ramalan. Lihat rincian per periode.");
  }
  return kalimat;
}

/**
 * Penggerak inflasi yang bisa dibuktikan dari modelnya sendiri: efek basis. Selisih y-on-y dua bulan
 * berurutan kira-kira sama dengan selisih kenaikan harga bulan itu dan bulan yang sama setahun lalu.
 * Dicari bulan dengan lompatan terbesar dalam 12 bulan ke depan.
 */
export function kalimatEfekBasis(
  jalur: BarisRamalan[],
  terakhir: number,
  bulanan: Titik[],
): string | null {
  let pilih: { ref: string; lompat: number } | null = null;
  let sebelum = terakhir;
  for (const b of jalur.slice(0, 12)) {
    const lompat = b.point - sebelum;
    if (!pilih || Math.abs(lompat) > Math.abs(pilih.lompat)) pilih = { ref: b.ref_period, lompat };
    sebelum = b.point;
  }
  if (!pilih || Math.abs(pilih.lompat) < 0.05) return null;
  const tahunLalu = `${Number(pilih.ref.slice(0, 4)) - 1}${pilih.ref.slice(4)}`;
  const dulu = bulanan.find((t) => t[0] === tahunLalu)?.[1];
  if (dulu == null) return null;
  const arah = pilih.lompat > 0 ? "naik" : "turun";
  return (
    `Gerak terbesar dalam setahun ke depan ada di ${periode(pilih.ref)}: inflasi setahun diperkirakan ${arah} sekitar ` +
    `${angka(Math.abs(pilih.lompat), 1)} poin persen. Penyebabnya efek basis: harga ${periode(tahunLalu)} ${gerakBulanan(dulu)}, ` +
    `sedangkan pola lima tahun terakhir untuk bulan itu ${gerakBulanan(dulu + pilih.lompat)}.`
  );
}

/** "naik 0,10%", dari angka yang tampil. */
function gerakBulanan(nilai: number): string {
  const tampil = Number(nilai.toFixed(2));
  if (tampil === 0) return "hampir tidak berubah";
  return `${tampil > 0 ? "naik" : "turun"} ${angka(Math.abs(tampil), 2)}%`;
}

/** "Artinya buatmu" untuk perkiraan: selalu bersyarat, dan tidak pernah berupa saran. */
export function artinyaPerkiraan(kunci: KunciKartu, nilai: number): string {
  if (kunci === "inflasi") {
    const hasil = Math.round((100000 * (1 + nilai / 100)) / 100) * 100;
    return `Bila perkiraan ini tepat, belanja yang setahun sebelumnya Rp100.000 menjadi sekitar Rp${angka(hasil, 0)}.`;
  }
  if (kunci === "pertumbuhan") {
    return `Bila perkiraan ini tepat, nilai barang dan jasa yang dihasilkan di Indonesia sekitar ${angka(nilai, 1)}% lebih besar dibanding periode yang sama setahun sebelumnya.`;
  }
  return `Bila perkiraan ini tepat, dari setiap 100 orang angkatan kerja, sekitar ${angka(nilai, 0)} belum mendapat pekerjaan.`;
}

export type BarisJangkaPanjang = { tahun: number; imf: number; rpjmn: number | null };

/** Proyeksi IMF untuk tahun sesudah angka resmi terakhir, dengan target RPJMN pertumbuhan bila ada. */
export function barisJangkaPanjang(imf: Titik[], resmi: Titik[], target: Target[]): BarisJangkaPanjang[] {
  const akhir = Math.max(...resmi.map((t) => Number(t[0])));
  return imf
    .filter((t) => Number(t[0]) > akhir)
    .map((t) => ({
      tahun: Number(t[0]),
      imf: t[1],
      rpjmn:
        target.find(
          (x) => x.series_id === SERI_PDB_TAHUNAN && x.target_kind === "rpjmn" && x.year === Number(t[0]),
        )?.value ?? null,
    }));
}

/** Kalimat panel jangka panjang: hanya angka dan selisihnya, tanpa vonis (PRD 4.4). */
export function kalimatJangkaPanjang(baris: BarisJangkaPanjang[], resmi: Titik[]): string | null {
  const akhir = [...baris].reverse().find((b) => b.rpjmn != null);
  if (!akhir || akhir.rpjmn == null || !resmi.length) return null;
  const puncak = resmi.reduce((a, b) => (b[1] > a[1] ? b : a));
  return (
    `Untuk ${akhir.tahun}, proyeksi IMF ${persen(akhir.imf, 1)} dan target RPJMN ${persen(akhir.rpjmn, 1)}, ` +
    `selisih ${angka(Math.abs(akhir.rpjmn - akhir.imf), 1)} poin persen. Sejak ${resmi[0][0]}, pertumbuhan ` +
    `tahunan tertinggi ${persen(puncak[1], 1)} pada ${puncak[0]}.`
  );
}
