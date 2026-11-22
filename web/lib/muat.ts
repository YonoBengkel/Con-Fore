// Pemuatan data bersama halaman Indonesia dan halaman rinci: angka resmi terakhir per pertanyaan, seri tahunan
// untuk patokan rata-rata, target, jadwal rilis, dan perkiraan. Hanya di server (ISR), lewat lib/data.ts.

import {
  bacaGrafik,
  bacaKalender,
  bacaMeta,
  bacaNilai,
  bacaRamalan,
  bacaStatus,
  bacaTarget,
  titikSeri,
  type BarisRamalan,
  type MetaSeri,
  type NilaiTerakhir,
} from "./data";
import { buatJawaban, type Jawaban } from "./jawaban";
import { SERI_KARTU, SERI_TAHUNAN, TOPIK, type KunciTopik } from "./konten";
import { TARGET_PREDIKSI, jalurUtama } from "./prediksi";

/** `ekstra`: seri grafik tambahan untuk halaman rinci, misalnya kelompok harga atau yang ikut memengaruhi. */
export async function muatIndonesia(ekstra: string[] = []) {
  const [meta, nilai, status, target, kalender, ramalan, grafik] = await Promise.all([
    bacaMeta(),
    bacaNilai(),
    bacaStatus(),
    bacaTarget(),
    bacaKalender(),
    bacaRamalan(),
    bacaGrafik([...TOPIK.flatMap((t) => SERI_KARTU[t.kartu]), ...Object.values(SERI_TAHUNAN), ...ekstra], true),
  ]);
  const metaPer = new Map<string, MetaSeri>(meta.map((m) => [m.series_id, m]));
  const nilaiPer = new Map<string, NilaiTerakhir>(nilai.map((n) => [n.series_id, n]));
  /** calendar_source untuk next_release_date satu seri, bila tercatat (SCHEMA 2.2). */
  const jadwal = (id: string) => {
    const tgl = metaPer.get(id)?.next_release_date?.slice(0, 10);
    return tgl
      ? kalender.find((r) => r.series_id === id && r.release_date.slice(0, 10) === tgl)?.calendar_source
      : undefined;
  };

  const jawaban: Partial<Record<KunciTopik, Jawaban>> = {};
  const perkiraan: Partial<Record<KunciTopik, BarisRamalan>> = {};
  for (const t of TOPIK) {
    // Seri pertama yang ada di latest_values: BPS dulu, salinan IMF sebagai cadangan.
    const id = SERI_KARTU[t.kartu].find((s) => metaPer.has(s) && nilaiPer.has(s));
    if (id) {
      jawaban[t.kunci] = buatJawaban({
        topik: t,
        meta: metaPer.get(id)!,
        nilai: nilaiPer.get(id)!,
        titik: titikSeri(grafik, id),
        tahunan: titikSeri(grafik, SERI_TAHUNAN[t.kartu]),
        target,
        kalender: jadwal(id),
      });
    }
    const seriRamalan = TARGET_PREDIKSI.find((x) => x.kunci === t.kartu)?.seri;
    const awal = seriRamalan ? jalurUtama(ramalan, seriRamalan)[0] : undefined;
    if (awal) perkiraan[t.kunci] = awal;
  }
  return { metaPer, nilaiPer, jadwal, status, grafik, jawaban, perkiraan };
}
