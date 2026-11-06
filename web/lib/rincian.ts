// Rincian inflasi per kelompok BPS untuk halaman detail inflasi (PRD 4.4).

import type { Titik } from "./data";
import { angka, periode } from "./format.ts";
import { KELOMPOK_INFLASI, SERI_INFLASI_BULANAN, SERI_KARTU } from "./konten.ts";

export type BarisRincian = { nama: string; setahun: number | null; sebulan: number | null };

/** "naik sekitar 2,6%", dari angka yang tampil (satu desimal). */
function gerak(nilai: number): string {
  const tampil = Number(nilai.toFixed(1));
  if (tampil === 0) return "hampir tidak berubah";
  return `${tampil > 0 ? "naik" : "turun"} sekitar ${angka(Math.abs(tampil), 1)}%`;
}

/**
 * Kalimat dan baris tabel pada periode terakhir yang dimiliki ketiga kelompok, atau null bila ada
 * kelompok yang belum punya angka setahun.
 */
export function rincianInflasi(
  seri: (id: string) => Titik[],
): { periode: string; kalimat: string; baris: BarisRincian[] } | null {
  const terakhir = KELOMPOK_INFLASI.map((k) => seri(k.setahun).at(-1)?.[0]);
  if (terakhir.some((p) => !p)) return null;
  const p = (terakhir as string[]).sort()[0];
  const pada = (id: string) => new Map(seri(id)).get(p) ?? null;

  const setahun = KELOMPOK_INFLASI.map((k) => pada(k.setahun));
  if (setahun.some((v) => v == null)) return null;
  const bagian = KELOMPOK_INFLASI.map((k, i) => `${k.nama.toLowerCase()} ${gerak(setahun[i]!)}`);
  const lalu = `${Number(p.slice(0, 4)) - 1}${p.slice(4)}`;
  const kalimat =
    `${periode(p)} dibanding ${periode(lalu)}: ` +
    `${bagian.slice(0, -1).join(", ")}, dan ${bagian[bagian.length - 1]}.`;

  return {
    periode: p,
    kalimat,
    baris: [
      { nama: "Umum", setahun: pada(SERI_KARTU.inflasi[0]), sebulan: pada(SERI_INFLASI_BULANAN) },
      ...KELOMPOK_INFLASI.map((k, i) => ({ nama: k.nama, setahun: setahun[i], sebulan: pada(k.sebulan) })),
    ],
  };
}
