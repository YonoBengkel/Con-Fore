// Ringkasan segitiga untuk dua lensa: skor dan kalimat yang sekaligus menjadi teks alternatif.

import type { Grafik, Target } from "./data";
import { titikSeri } from "./data";
import { angka } from "./format";
import {
  SERI_SEGITIGA,
  TAHUN_AKHIR,
  TAHUN_AWAL,
  gabungTahunan,
  skorMasaLalu,
  skorTarget,
  tahunLengkap,
  zonaTarget,
  type NilaiTahun,
  type Skor,
  type ZonaTarget,
} from "./skor";

export type Lensa = {
  skor: Skor;
  kalimat: string;
};

export type Ringkasan = {
  tahun: number;
  nilai: NilaiTahun;
  masaLalu: Lensa;
  target: (Lensa & { zona: ZonaTarget; sumber: Target[] }) | null;
};

function sebutan(skor: number): string {
  if (skor >= 75) return "baik";
  if (skor >= 50) return "cukup baik";
  if (skor >= 25) return "kurang baik";
  return "lemah";
}

const bulat = (n: number) => Math.round(n);
const persen = (n: number, d = 1) => `${angka(n, d)}%`;

export function buatRingkasan(grafik: Map<string, Grafik>, target: Target[]): Ringkasan | null {
  const data = gabungTahunan(
    titikSeri(grafik, SERI_SEGITIGA.pertumbuhan),
    titikSeri(grafik, SERI_SEGITIGA.inflasi),
    titikSeri(grafik, SERI_SEGITIGA.pengangguran),
  );
  const tahun = tahunLengkap(data);
  if (tahun == null) return null;
  const nilai = data.get(tahun)!;
  const lalu = skorMasaLalu(tahun, data);
  if (!lalu) return null;

  const g = persen(nilai.pertumbuhan);
  const i = persen(nilai.inflasi);
  const u = persen(nilai.pengangguran, 2);

  const masaLalu: Lensa = {
    skor: lalu,
    kalimat:
      `Tahun ${tahun} dibanding ${TAHUN_AWAL}-${TAHUN_AKHIR}: pertumbuhan ekonomi ${g} ` +
      `(skor ${bulat(lalu.pertumbuhan)}, ${sebutan(lalu.pertumbuhan)}), harga stabil dengan inflasi ` +
      `akhir tahun ${i} (skor ${bulat(lalu.harga)}, ${sebutan(lalu.harga)}), dan lapangan kerja ` +
      `dengan pengangguran ${u} (skor ${bulat(lalu.kerja)}, ${sebutan(lalu.kerja)}). ` +
      `Skor mendekati 100 berarti termasuk yang terbaik sejak ${TAHUN_AWAL}, skor 50 berarti di tengah.`,
  };

  const zt = zonaTarget(target, tahun);
  let lensaTarget: Ringkasan["target"] = null;
  if (zt) {
    const z = zt.zona;
    const s = skorTarget(nilai, z);
    const bawah = persen(z.inflasiTengah - 1);
    const atas = persen(z.inflasiTengah + 1);
    const masukHarga = Math.abs(nilai.inflasi - z.inflasiTengah) <= 1;
    lensaTarget = {
      zona: z,
      sumber: zt.sumber,
      skor: s,
      kalimat:
        `Tahun ${tahun} dibanding target resmi: pertumbuhan ekonomi ${g} ` +
        `${nilai.pertumbuhan >= z.pertumbuhanMin ? "mencapai" : "di bawah"} target APBN ` +
        `${persen(z.pertumbuhanMin)} (skor ${bulat(s.pertumbuhan)}), inflasi akhir tahun ${i} ` +
        `${masukHarga ? "di dalam" : "di luar"} sasaran ${bawah} sampai ${atas} ` +
        `(skor ${bulat(s.harga)}), dan pengangguran ${u} ` +
        `${nilai.pengangguran <= z.tptBatasAtas ? "tidak melewati" : "melewati"} batas atas target APBN ` +
        `${persen(z.tptBatasAtas, 2)} (skor ${bulat(s.kerja)}). Skor 100 berarti target tercapai, ` +
        `dan turun 25 untuk setiap 1 poin persen di luar target.`,
    };
  }

  return { tahun, nilai, masaLalu, target: lensaTarget };
}
