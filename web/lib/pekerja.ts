// Kalimat otomatis pekerja formal dan informal (PRD 4.4). Hanya membandingkan ronde bulan yang
// sama, dan memakai porsi terhadap seluruh pekerja, bukan jumlah orang.

import type { Titik } from "./data";
import { angka, periode } from "./format.ts";

/** Perubahan porsi (poin persen) di bawah ini ditulis "hampir tidak berubah". */
export const AMBANG_PORSI = 0.1;

const tahunLalu = (p: string) => `${Number(p.slice(0, 4)) - 1}${p.slice(4)}`;

function arahPoin(selisih: number): string {
  return `${selisih > 0 ? "naik" : "turun"} ${angka(Math.abs(selisih), 2)} poin persen`;
}

export function kalimatPekerja(
  formal: Titik[],
  tpt: Titik[],
): { porsi: string; hubungan: string | null } | null {
  const akhir = formal[formal.length - 1];
  if (!akhir) return null;
  const [ronde, nilai] = akhir;
  const lalu = tahunLalu(ronde);
  const pembanding = new Map(formal).get(lalu);
  const pokok = `Porsi pekerja formal ${periode(ronde)}: ${angka(nilai, 2)}%`;
  if (pembanding == null) return { porsi: `${pokok}.`, hubungan: null };

  // Dihitung dari angka yang tampil, sama seperti kalimat perubahan di kartu.
  const selisih = Number(nilai.toFixed(2)) - Number(pembanding.toFixed(2));
  const tetap = Math.abs(selisih) < AMBANG_PORSI;
  const arah = tetap ? "hampir tidak berubah" : arahPoin(selisih);
  const porsi = `${pokok}, ${arah} dari ${periode(lalu)} (${angka(pembanding, 2)}%).`;

  const peta = new Map(tpt);
  const kini = peta.get(ronde);
  const dulu = peta.get(lalu);
  if (kini == null || dulu == null) return { porsi, hubungan: null };

  const ubahTpt = Number((kini - dulu).toFixed(2));
  const komposisi = tetap
    ? "komposisi pekerja formal dan informal hampir tidak berubah"
    : `komposisi pekerja bergeser ke sektor ${selisih > 0 ? "formal" : "informal"}`;
  // "tetapi" hanya bila komposisi tidak sejalan dengan arah pengangguran.
  const sejalan = ubahTpt === 0 || (ubahTpt < 0 ? !tetap && selisih > 0 : tetap || selisih < 0);
  const hubungan =
    `Pada ronde yang sama, pengangguran ${ubahTpt === 0 ? "tidak berubah" : arahPoin(ubahTpt)}, ` +
    `${sejalan ? "dan" : "tetapi"} ${komposisi}.`;
  return { porsi, hubungan };
}
