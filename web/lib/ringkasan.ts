// Ringkasan segitiga untuk dua lensa: skor dan kalimat yang sekaligus menjadi teks alternatif.

import type { Grafik, Target } from "./data";
import { titikSeri } from "./data";
import { angka } from "./format";
import {
  NAMA_STATUS,
  SERI_SEGITIGA,
  TAHUN_AKHIR,
  TAHUN_AWAL,
  gabungTahunan,
  skorMasaLalu,
  skorTarget,
  statusLensa,
  tahunLengkap,
  zonaTarget,
  type Dimensi,
  type NilaiTahun,
  type Skor,
  type Status,
  type ZonaTarget,
} from "./skor";

export type Lensa = {
  skor: Skor;
  status: Record<Dimensi, Status>;
  kalimat: string;
};

export type Ringkasan = {
  tahun: number;
  nilai: NilaiTahun;
  masaLalu: Lensa;
  target: (Lensa & { zona: ZonaTarget; sumber: Target[] }) | null;
};

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

  const statusLalu = statusLensa(lalu, "masaLalu");
  const masaLalu: Lensa = {
    skor: lalu,
    status: statusLalu,
    kalimat:
      `Tahun ${tahun} dibanding ${TAHUN_AWAL}-${TAHUN_AKHIR}: pertumbuhan ekonomi ${g} ` +
      `(skor ${bulat(lalu.pertumbuhan)}, ${NAMA_STATUS[statusLalu.pertumbuhan]}), harga stabil dengan ` +
      `inflasi akhir tahun ${i} (skor ${bulat(lalu.harga)}, ${NAMA_STATUS[statusLalu.harga]}), dan ` +
      `lapangan kerja dengan pengangguran ${u} (skor ${bulat(lalu.kerja)}, ${NAMA_STATUS[statusLalu.kerja]}). ` +
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
    const statusTarget = statusLensa(s, "target");
    lensaTarget = {
      zona: z,
      sumber: zt.sumber,
      skor: s,
      status: statusTarget,
      kalimat:
        `Tahun ${tahun} dibanding target resmi: pertumbuhan ekonomi ${g} ` +
        `${nilai.pertumbuhan >= z.pertumbuhanMin ? "mencapai" : "di bawah"} target APBN ` +
        `${persen(z.pertumbuhanMin)} (skor ${bulat(s.pertumbuhan)}, ${NAMA_STATUS[statusTarget.pertumbuhan]}), ` +
        `inflasi akhir tahun ${i} ${masukHarga ? "di dalam" : "di luar"} sasaran ${bawah} sampai ${atas} ` +
        `(skor ${bulat(s.harga)}, ${NAMA_STATUS[statusTarget.harga]}), dan pengangguran ${u} ` +
        `${nilai.pengangguran <= z.tptBatasAtas ? "tidak melewati" : "melewati"} batas atas target APBN ` +
        `${persen(z.tptBatasAtas, 2)} (skor ${bulat(s.kerja)}, ${NAMA_STATUS[statusTarget.kerja]}). ` +
        `Skor 100 berarti target tercapai, dan turun 25 untuk setiap 1 poin persen di luar target.`,
    };
  }

  return { tahun, nilai, masaLalu, target: lensaTarget };
}
