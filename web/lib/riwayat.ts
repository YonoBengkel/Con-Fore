// Isi grafik riwayat di halaman detail: titik yang dijarangkan, pembanding tiap titik, dan kalimat per periode.
// Fungsi murni, dipakai di server dan di browser.

import type { Titik } from "./data";
import { angka, desimalUntuk, nilaiSeri, perubahan, periode } from "./format.ts";

/** Ambil paling banyak `maks` titik dengan langkah tetap, titik terakhir selalu ikut. */
export function jarangkan(titik: Titik[], maks: number): Titik[] {
  if (titik.length <= maks) return titik;
  const langkah = Math.ceil(titik.length / maks);
  const hasil = titik.filter((_, i) => i % langkah === 0);
  if (hasil[hasil.length - 1] !== titik[titik.length - 1]) hasil.push(titik[titik.length - 1]);
  return hasil;
}

/** Periode, nilai, dan nilai pembandingnya. */
export type BarisRiwayat = [string, number, number | null];

/**
 * Pembanding dihitung dari titik asli, supaya penjarangan seri harian tidak mengubah artinya. TPT per ronde
 * dibandingkan dengan ronde bulan yang sama tahun lalu, sama seperti confore/publish.py.
 */
export function barisRiwayat(titik: Titik[], konsep: string, maks = 700): BarisRiwayat[] {
  const posisi = new Map(titik.map((t, i) => [t[0], i]));
  return jarangkan(titik, maks).map(([p, v]) => {
    const i = posisi.get(p) ?? 0;
    if (konsep !== "round_rate") return [p, v, i > 0 ? titik[i - 1][1] : null];
    const m = /^(\d{4})-(\d{2})$/.exec(p);
    const lalu = m ? posisi.get(`${Number(m[1]) - 1}-${m[2]}`) : undefined;
    return [p, v, lalu != null ? titik[lalu][1] : null];
  });
}

/** "Oktober 2026: 3,2%, turun 0,1 poin persen dari bulan sebelumnya (3,3%)." */
export function kalimatPeriode(
  [p, v, sebelum]: BarisRiwayat,
  satuan: string,
  konsep: string,
  frekuensi: string,
): string {
  const ubah = perubahan(v, sebelum, satuan, konsep, frekuensi);
  return `${periode(p)}: ${nilaiSeri(v, satuan, konsep)}${ubah ? `, ${ubah}` : ""}.`;
}

/** Jendela ringkasan menurut frekuensi: kuartalan dan bulanan 5 tahun, harian 1 tahun, tahunan semua. */
const JENDELA: Record<string, { n: number; nama: string }> = {
  Q: { n: 20, nama: "lima tahun terakhir" },
  M: { n: 60, nama: "lima tahun terakhir" },
  D: { n: 260, nama: "setahun terakhir" },
};

/**
 * Kesimpulan yang bisa dihitung dari riwayat itu sendiri: rentang, rata-rata, dan posisi angka terakhir.
 * Sengaja tanpa penilaian baik atau buruk (PRD 4.4).
 */
export function kalimatRiwayat(titik: Titik[], satuan: string, konsep: string, frekuensi: string): string | null {
  if (titik.length < 2) return null;
  const jendela = JENDELA[frekuensi];
  const penuh = jendela != null && titik.length >= jendela.n;
  const potong = penuh ? titik.slice(-jendela.n) : titik;
  const teks = (v: number) => nilaiSeri(v, satuan, konsep);
  const rendah = potong.reduce((a, t) => (t[1] < a[1] ? t : a));
  const tinggi = potong.reduce((a, t) => (t[1] > a[1] ? t : a));
  const rata = potong.reduce((a, t) => a + t[1], 0) / potong.length;
  const akhir = potong[potong.length - 1][1];
  const d = desimalUntuk(rata, konsep);
  const posisi =
    angka(akhir, d) === angka(rata, d) ? "sama dengan rata-rata itu" : akhir > rata ? "di atas rata-rata itu" : "di bawah rata-rata itu";
  const awalan = penuh ? `Dalam ${jendela.nama}` : `Sejak ${periode(potong[0][0])}`;
  return `${awalan}, angka ini bergerak antara ${teks(rendah[1])} (${periode(rendah[0])}) dan ${teks(tinggi[1])} (${periode(tinggi[0])}), dengan rata-rata ${teks(rata)}. Angka terakhir ${teks(akhir)}, ${posisi}.`;
}
