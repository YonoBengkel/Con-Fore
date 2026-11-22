// Jawaban empat pertanyaan untuk halaman Indonesia dan halaman rinci (PRD 4.1 dan 4.2): kalimat, angka,
// label, contoh sehari-hari, perbandingan dalam kalimat, dan waktu data, serta ringkasan bercerita.
// Fungsi murni tanpa waktu sekarang, dites di jawaban.test.ts. Setiap perbandingan dibaca dari angka
// yang tampil, supaya kalimatnya selalu cocok dengan angka di halaman.

import type { BarisRamalan, MetaSeri, NilaiTerakhir, Target, Titik } from "./data";
import { angka, periode, tanggal } from "./format.ts";
import {
  SERI_TAHUNAN,
  TAHUN_AKHIR,
  TAHUN_AWAL,
  arahInflasi,
  keranjangKini,
  labelSeri,
  type KunciTopik,
  type Topik,
} from "./konten.ts";
import { setahunSebelum } from "./riwayat.ts";

/** Selisih angka tampil sampai batas ini (poin persen) ditulis "sedikit". */
export const SEDIKIT = 0.25;
const TOLERANSI = 1e-9;

const tampil = (v: number, d: number) => Number(v.toFixed(d));
const persen = (v: number, d: number) => `${angka(v, d)}%`;
const kapital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SEBUT_RATA = `rata-rata tahun ${TAHUN_AWAL} sampai ${TAHUN_AKHIR}`;

/** Rata-rata tahunan TAHUN_AWAL sampai TAHUN_AKHIR, atau null bila ada tahun yang belum ada. */
export function rataJangkaPanjang(tahunan: Titik[]): number | null {
  const isi = tahunan.filter(([p]) => /^\d{4}$/.test(p) && Number(p) >= TAHUN_AWAL && Number(p) <= TAHUN_AKHIR);
  if (isi.length !== TAHUN_AKHIR - TAHUN_AWAL + 1) return null;
  return isi.reduce((a, [, v]) => a + v, 0) / isi.length;
}

const KATA: Record<KunciTopik, { naik: string; turun: string }> = {
  harga: { naik: "lebih tinggi", turun: "lebih rendah" },
  kerja: { naik: "lebih tinggi", turun: "lebih rendah" },
  ekonomi: { naik: "lebih cepat", turun: "lebih lambat" },
};

/** "sedikit lebih rendah dari", "lebih cepat dari", atau "sama dengan". */
export function arahBanding(
  kini: number,
  desimalKini: number,
  patokan: number,
  desimalPatokan: number,
  kunci: KunciTopik,
): string {
  const a = tampil(kini, desimalKini);
  const b = tampil(patokan, desimalPatokan);
  if (Math.abs(a - b) < TOLERANSI) return "sama dengan";
  const kata = a > b ? KATA[kunci].naik : KATA[kunci].turun;
  return `${Math.abs(a - b) <= SEDIKIT + TOLERANSI ? "sedikit " : ""}${kata} dari`;
}

/** Posisi angka terhadap target satu nilai atau satu rentang: "di dalam", "sedikit di atas", dan seterusnya. */
function posisiTarget(a: number, bawah: number, atas: number): string {
  if (a > atas + TOLERANSI) return `${a - atas <= SEDIKIT + TOLERANSI ? "sedikit " : ""}di atas`;
  if (a < bawah - TOLERANSI) return `${bawah - a <= SEDIKIT + TOLERANSI ? "sedikit " : ""}di bawah`;
  return bawah === atas ? "sama dengan" : "di dalam";
}

/**
 * Patokan target pemerintah untuk tahun data itu, sebagai patokan, bukan vonis tercapai atau gagal (PRD 4.2).
 * Sasaran inflasi PMK tanpa batas tertulis memakai titik tengah ± 1 poin persen.
 */
export function kalimatTarget(topik: Topik, nilai: number, periodeData: string, target: Target[]): string | null {
  const tahun = Number(periodeData.slice(0, 4));
  const t = target.find(
    (x) => x.series_id === SERI_TAHUNAN[topik.kartu] && x.year === tahun && x.target_kind === topik.target.jenis,
  );
  if (!t) return null;
  const d = topik.desimal;
  const a = tampil(nilai, d);
  const frasa = `${topik.target.frasa} ${tahun}`;
  let bawah = t.lower;
  let atas = t.upper;
  if ((bawah == null || atas == null) && t.value != null) {
    [bawah, atas] = t.target_kind === "pmk" ? [t.value - 1, t.value + 1] : [t.value, t.value];
  }
  if (bawah == null || atas == null) return null;
  const posisi = posisiTarget(a, tampil(bawah, d), tampil(atas, d));
  const isi = bawah === atas ? persen(bawah, d) : `${persen(bawah, d)} sampai ${persen(atas, d)}`;
  return `${kapital(posisi)} ${frasa}, yaitu ${isi}.`;
}

const BULAN_KUARTAL = ["Januari sampai Maret", "April sampai Juni", "Juli sampai September", "Oktober sampai Desember"];

/** "Angka resmi BPS untuk Oktober 2026", "... untuk survei Agustus 2026", atau "... (Juli sampai September)". */
export function labelAngka(m: MetaSeri, p: string): string {
  const label = labelSeri(m);
  const asal = kapital(label);
  const q = /^(\d{4})-Q([1-4])$/.exec(p);
  const kapan =
    m.concept === "round_rate" ? `survei ${periode(p)}` : q ? `${periode(p)} (${BULAN_KUARTAL[Number(q[2]) - 1]})` : periode(p);
  return `${asal} untuk ${kapan}`;
}

/** "Rilis berikutnya 1 Desember 2026.", dengan "diperkirakan" bila tanggalnya bukan dari jadwal resmi. */
export function kalimatWaktu(m: MetaSeri, kalender: string | undefined): string | null {
  const tgl = m.next_release_date?.slice(0, 10);
  if (!tgl) return null;
  const perkiraan = !kalender || kalender.endsWith("-perkiraan");
  return `Rilis berikutnya ${perkiraan ? "diperkirakan " : ""}${tanggal(tgl)}.`;
}

function kalimatJawaban(kunci: KunciTopik, v: number, d: number): string {
  const t = tampil(v, d);
  if (kunci === "kerja") {
    return `Dari semua orang yang bekerja atau sedang mencari kerja, ${persen(v, d)} belum mendapat pekerjaan.`;
  }
  if (kunci === "harga") {
    return t === 0
      ? "Dibanding setahun lalu, rata-rata harga barang dan jasa hampir sama."
      : `Dibanding setahun lalu, harga barang dan jasa ${t > 0 ? "naik" : "turun"} rata-rata ${persen(Math.abs(v), d)}.`;
  }
  return t === 0
    ? "Dibanding setahun lalu, besar ekonomi Indonesia hampir sama."
    : `Dibanding setahun lalu, ekonomi Indonesia ${t > 0 ? "tumbuh" : "menyusut"} ${persen(Math.abs(v), d)}.`;
}

/** Contoh sehari-hari (PRD 4.4): keranjang belanja, 100 orang, dan satu kue. */
function contohSehari(kunci: KunciTopik, v: number, d: number, sebelumnya: number | null, bulanan: boolean): string {
  if (kunci === "harga") {
    return [
      `Bayangkan satu keranjang belanja yang isinya sama setiap bulan. Keranjang yang setahun lalu Rp100.000 kini sekitar ${keranjangKini(v)}.`,
      bulanan ? arahInflasi(v, sebelumnya) : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (kunci === "kerja") {
    return `Bayangkan 100 orang yang bekerja atau sedang mencari kerja. Sekitar ${angka(v, 0)} di antaranya belum mendapat pekerjaan.`;
  }
  return `Bayangkan semua barang dan jasa yang dihasilkan di Indonesia sebagai satu kue. Kuenya kini ${persen(Math.abs(v), d)} ${tampil(v, d) >= 0 ? "lebih besar" : "lebih kecil"} dibanding setahun sebelumnya.`;
}

export type Jawaban = {
  topik: Topik;
  meta: MetaSeri;
  nilai: NilaiTerakhir;
  kalimat: string;
  angka: string;
  label: string;
  contoh: string;
  /** Rata-rata jangka panjang, juga dipakai ringkasan bercerita. */
  rata: number | null;
  banding: string[];
  waktu: string | null;
};

export function buatJawaban({
  topik,
  meta,
  nilai,
  titik,
  tahunan,
  target,
  kalender,
}: {
  topik: Topik;
  meta: MetaSeri;
  nilai: NilaiTerakhir;
  titik: Titik[];
  tahunan: Titik[];
  target: Target[];
  kalender?: string;
}): Jawaban {
  const d = topik.desimal;
  const v = nilai.value;
  const banding: string[] = [];
  const lalu = setahunSebelum(titik.filter(([p]) => p <= nilai.period));
  if (lalu) {
    banding.push(`${kapital(arahBanding(v, d, lalu[1], d, topik.kunci))} setahun lalu, ${periode(lalu[0])} (${persen(lalu[1], d)}).`);
  }
  const rata = rataJangkaPanjang(tahunan);
  if (rata != null) {
    banding.push(`${kapital(arahBanding(v, d, rata, 1, topik.kunci))} ${SEBUT_RATA} (${persen(rata, 1)}).`);
  }
  const target1 = kalimatTarget(topik, v, nilai.period, target);
  if (target1) banding.push(target1);
  return {
    topik,
    meta,
    nilai,
    kalimat: kalimatJawaban(topik.kunci, v, d),
    angka: persen(v, d),
    label: labelAngka(meta, nilai.period),
    contoh: contohSehari(topik.kunci, v, d, nilai.previous_value, meta.frequency === "M"),
    rata,
    banding,
    waktu: kalimatWaktu(meta, kalender),
  };
}

/** Bagian ringkasan bercerita: teks biasa, atau angka yang ditebalkan dan diberi warna pertanyaannya. */
export type Bagian = string | { angka: string; kelas: KunciTopik | "ke-depan" };

/**
 * Ringkasan bercerita di awal halaman Indonesia (bentuk C): satu kalimat per pertanyaan dengan angkanya, lalu
 * label yang menyebut kalimat mana yang angka resmi dan mana yang perkiraan.
 */
export function ringkasanCerita(
  jawaban: Partial<Record<KunciTopik, Jawaban>>,
  perkiraan: { inflasi?: BarisRamalan; pertumbuhan?: BarisRamalan },
): { kalimat: Bagian[][]; label: string } | null {
  const kalimat: Bagian[][] = [];
  const h = jawaban.harga;
  if (h) {
    const v = h.nilai.value;
    const t = tampil(v, 1);
    kalimat.push(
      t === 0
        ? ["Dibanding setahun lalu, rata-rata harga barang hampir sama."]
        : [
            `Dibanding setahun lalu, harga barang ${t > 0 ? "naik" : "turun"} rata-rata `,
            { angka: persen(Math.abs(v), 1), kelas: "harga" },
            `: keranjang belanja yang dulu Rp100.000 kini sekitar ${keranjangKini(v)}.`,
          ],
    );
  }
  const k = jawaban.kerja;
  if (k) {
    const v = k.nilai.value;
    let pembanding = "";
    if (k.rata != null) {
      const selisih = tampil(v, 2) - tampil(k.rata, 1);
      const banyak =
        Math.abs(selisih) <= SEDIKIT + TOLERANSI ? "hampir sama dengan" : selisih < 0 ? "lebih sedikit dari" : "lebih banyak dari";
      pembanding = `, ${banyak} ${SEBUT_RATA}`;
    }
    kalimat.push([
      "Dari setiap 100 orang yang bekerja atau mencari kerja, sekitar ",
      { angka: angka(v, 0), kelas: "kerja" },
      ` belum mendapat pekerjaan${pembanding}.`,
    ]);
  }
  const e = jawaban.ekonomi;
  if (e) {
    const v = e.nilai.value;
    const pembanding = e.rata != null ? `, ${arahBanding(v, 1, e.rata, 1, "ekonomi")} ${SEBUT_RATA}` : "";
    kalimat.push([
      tampil(v, 1) >= 0 ? "Ekonomi tumbuh " : "Ekonomi menyusut ",
      { angka: persen(Math.abs(v), 1), kelas: "ekonomi" },
      `${pembanding}.`,
    ]);
  }
  if (!kalimat.length) return null;
  const resmi = [h, k, e].filter((j): j is Jawaban => j != null);
  const asal = resmi.every((j) => j.meta.source_id === "bps")
    ? "angka resmi BPS"
    : "angka resmi BPS, sebagian lewat salinan IMF";
  const { inflasi, pertumbuhan } = perkiraan;
  if (inflasi && pertumbuhan) {
    kalimat.push([
      `Ke depan, Con-Fore memperkirakan inflasi ${periode(inflasi.ref_period)} sekitar `,
      { angka: persen(inflasi.point, 1), kelas: "ke-depan" },
      `, dan pertumbuhan ${periode(pertumbuhan.ref_period)} sekitar `,
      { angka: persen(pertumbuhan.point, 1), kelas: "ke-depan" },
      ".",
    ]);
    const sebut = ["Kalimat pertama", "Dua kalimat pertama", "Tiga kalimat pertama"][resmi.length - 1];
    return { kalimat, label: `${sebut} ${asal}. Kalimat terakhir perkiraan Con-Fore, bukan angka resmi.` };
  }
  return { kalimat, label: `Semua kalimat di atas ${asal}.` };
}
