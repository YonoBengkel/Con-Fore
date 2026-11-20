// Data terstruktur JSON-LD (schema.org) untuk mesin pencari: WebSite di beranda, Dataset per seri di
// halaman detail, dan Dataset perkiraan di Prediksi. Isinya hanya yang juga tampil di halaman atau di
// CSV-nya. Tanggal ubahnya mengikuti kapan isi benar-benar berubah, bukan waktu build, dan dipakai juga
// untuk lastModified di sitemap.

import type { BarisRamalan, MetaSeri, NilaiTerakhir, Sumber, Titik } from "./data";
import { periode } from "./format.ts";
import { labelSeri } from "./konten.ts";
import { TARGET_PREDIKSI } from "./prediksi.ts";
import { ALAMAT_SITUS } from "./situs.ts";

type Objek = Record<string, unknown>;

const KONTEKS = "https://schema.org";
const CON_FORE = { "@type": "Organization", name: "Con-Fore", url: ALAMAT_SITUS };
const INDONESIA = { "@type": "Place", name: "Indonesia" };

/** Batas periode dalam ISO 8601. Kuartal menjadi bulan pertama atau terakhirnya: 2026-Q3 jadi 2026-07 atau 2026-09. */
export function isoPeriode(p: string, ujung: "awal" | "akhir"): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(p);
  if (!m) return p; // "2026", "2026-10", dan "2026-10-31" sudah ISO 8601
  const bulan = (Number(m[2]) - 1) * 3 + (ujung === "awal" ? 1 : 3);
  return `${m[1]}-${String(bulan).padStart(2, "0")}`;
}

/** Cakupan waktu sebagai interval ISO 8601, misalnya "2024-01/2026-10". */
export function cakupanWaktu(periodeAwal: string, periodeAkhir: string): string {
  return `${isoPeriode(periodeAwal, "awal")}/${isoPeriode(periodeAkhir, "akhir")}`;
}

/**
 * Tanggal isi halaman satu seri berubah: hari Con-Fore pertama kali melihat angka terakhirnya, atau
 * tanggal rilisnya bila hari itu tidak tercatat.
 */
export function tanggalUbah(n: NilaiTerakhir | undefined): string | undefined {
  return (n?.seen_date ?? n?.release_date)?.slice(0, 10) || undefined;
}

/** Tanggal paling baru dari daftar tanggal atau timestamp ISO; undefined bila tidak ada satu pun. */
export function terbaru(daftar: (string | null | undefined)[]): string | undefined {
  return daftar
    .filter((t): t is string => Boolean(t))
    .map((t) => t.slice(0, 10))
    .sort()
    .at(-1);
}

/** Isi tag script: JSON dengan "<" di-escape, supaya teks data tidak bisa menutup tag script. */
export function teksJsonLd(data: Objek): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** WebSite di beranda, supaya nama situs terbaca di hasil pencarian. */
export function jsonLdSitus(deskripsi: string): Objek {
  return {
    "@context": KONTEKS,
    "@type": "WebSite",
    name: "Con-Fore",
    url: `${ALAMAT_SITUS}/`,
    inLanguage: "id",
    description: deskripsi,
  };
}

/**
 * Dataset satu seri untuk halaman detail. Lembaga sumbernya pembuat data dan Con-Fore penerbit
 * salinannya, kecuali seri olahan yang dibuat Con-Fore dari data sumber. Lisensinya halaman syarat sumber.
 */
export function jsonLdSeri(
  m: MetaSeri,
  titik: Titik[],
  nilai: NilaiTerakhir | undefined,
  sumber: Sumber | undefined,
): Objek {
  const label = labelSeri(m);
  const diIndonesia = m.country === "IDN";
  const awal = titik[0]?.[0];
  const akhir = titik[titik.length - 1]?.[0];
  const rentang = awal && akhir ? `, ${periode(awal)} sampai ${periode(akhir)}` : "";
  return {
    "@context": KONTEKS,
    "@type": "Dataset",
    name: m.name_id,
    description:
      `${m.name_id}${diIndonesia ? " di Indonesia" : ""}${rentang} (${m.unit}). ` +
      `Sumber: ${sumber?.name ?? m.source_id}, dengan label "${label}" di Con-Fore. ` +
      "Con-Fore adalah situs independen, bukan situs resmi lembaga mana pun.",
    url: `${ALAMAT_SITUS}/indikator/${m.series_id}`,
    inLanguage: "id",
    isAccessibleForFree: true,
    creator: label.startsWith("dihitung")
      ? CON_FORE
      : sumber && { "@type": "Organization", name: sumber.name, url: sumber.url },
    publisher: CON_FORE,
    isBasedOn: m.citation.match(/https?:\/\/\S+/)?.[0].replace(/[.,;)]+$/, ""),
    license: sumber?.terms_url,
    creditText: sumber?.attribution_text,
    spatialCoverage: diIndonesia ? INDONESIA : undefined,
    temporalCoverage: awal && akhir ? cakupanWaktu(awal, akhir) : undefined,
    dateModified: tanggalUbah(nilai),
    variableMeasured: { "@type": "PropertyValue", name: m.name_id, unitText: m.unit },
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "text/csv",
      contentUrl: `${ALAMAT_SITUS}/api/csv/${m.series_id}`,
    },
  };
}

/**
 * Dataset perkiraan di Prediksi, dengan satu unduhan CSV per target. Lisensi sengaja tidak ditulis:
 * angka olahan Con-Fore tidak mencantumkan lisensi.
 */
export function jsonLdPerkiraan(ramalan: BarisRamalan[], meta: MetaSeri[]): Objek {
  const utama = ramalan.filter((b) => b.is_main && TARGET_PREDIKSI.some((t) => t.seri === b.series_id));
  const batas = utama.flatMap((b) => [isoPeriode(b.ref_period, "awal"), isoPeriode(b.ref_period, "akhir")]).sort();
  return {
    "@context": KONTEKS,
    "@type": "Dataset",
    name: "Perkiraan pertumbuhan ekonomi, inflasi, dan pengangguran Indonesia",
    description:
      "Perkiraan pertumbuhan, inflasi, dan pengangguran Indonesia, lengkap dengan rentang dan catatan seberapa " +
      "sering perkiraan itu meleset. Dihitung Con-Fore dari data resmi BPS. Bukan angka resmi dan bukan nasihat keuangan.",
    url: `${ALAMAT_SITUS}/prediksi`,
    inLanguage: "id",
    isAccessibleForFree: true,
    creator: CON_FORE,
    publisher: CON_FORE,
    isBasedOn: TARGET_PREDIKSI.map((t) => `${ALAMAT_SITUS}/indikator/${t.seri}`),
    spatialCoverage: INDONESIA,
    temporalCoverage: batas.length ? `${batas[0]}/${batas[batas.length - 1]}` : undefined,
    dateModified: terbaru(utama.map((b) => b.origin_date)),
    variableMeasured: TARGET_PREDIKSI.map((t) => ({
      "@type": "PropertyValue",
      name: t.judul,
      unitText: meta.find((m) => m.series_id === t.seri)?.unit,
    })),
    distribution: TARGET_PREDIKSI.map((t) => ({
      "@type": "DataDownload",
      name: `Perkiraan ${t.judul.toLowerCase()}`,
      encodingFormat: "text/csv",
      contentUrl: `${ALAMAT_SITUS}/api/csv/perkiraan/${t.kunci}`,
    })),
  };
}
