// Daftar halaman untuk mesin pencari: hanya halaman yang ditautkan situs. lastModified mengikuti kapan isi
// halaman berubah (angka baru atau perkiraan baru), dengan aturan yang sama seperti dateModified di
// JSON-LD (web/lib/jsonld.ts). Halaman depan dan Tentang data tanpa tanggal, karena isinya hanya berubah lewat kode.

import type { MetadataRoute } from "next";
import { bacaNilai, bacaRamalan } from "@/lib/data";
import { tanggalUbah, terbaru } from "@/lib/jsonld";
import { KELOMPOK_INFLASI, SERI_DITAUTKAN, SERI_FORMAL, SERI_KARTU, SERI_TAHUNAN, TOPIK } from "@/lib/konten";
import { TARGET_PREDIKSI } from "@/lib/prediksi";
import { ALAMAT_SITUS } from "@/lib/situs";

// 6 jam, sama dengan halaman; /api/revalidate ikut menandainya basi lewat tag Supabase.
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [nilai, ramalan] = await Promise.all([bacaNilai(), bacaRamalan()]);
  const ubah = new Map(nilai.map((n) => [n.series_id, tanggalUbah(n)]));
  const tgl = (seri: string[]) => terbaru(seri.map((s) => ubah.get(s)));
  const perkiraan = ramalan.filter((b) => b.is_main).map((b) => b.origin_date);
  const seriTopik = TOPIK.flatMap((t) => [...SERI_KARTU[t.kartu], SERI_TAHUNAN[t.kartu]]);
  const rinci: Record<string, string[]> = {
    harga: KELOMPOK_INFLASI.map((k) => k.setahun),
    kerja: [SERI_FORMAL],
    ekonomi: [],
  };
  const seri = [...new Set(SERI_DITAUTKAN)];
  const halaman: [string, string | undefined][] = [
    ["", undefined],
    ["/indonesia", terbaru([tgl(seriTopik), ...perkiraan])],
    ...TOPIK.map((t): [string, string | undefined] => [
      `/indonesia/${t.kunci}`,
      terbaru([
        tgl([...SERI_KARTU[t.kartu], SERI_TAHUNAN[t.kartu], ...rinci[t.kunci], ...t.penggerak]),
        ...ramalan.filter((b) => b.is_main && TARGET_PREDIKSI.some((x) => x.kunci === t.kartu && x.seri === b.series_id)).map((b) => b.origin_date),
      ]),
    ]),
    ["/indonesia/ke-depan", terbaru([...perkiraan, tgl(TARGET_PREDIKSI.flatMap((t) => [t.seri, t.imf]))])],
    ["/tentang-data", undefined],
    ...seri.map((id): [string, string | undefined] => [`/indikator/${id}`, ubah.get(id)]),
  ];
  return halaman.map(([jalur, tanggal]) => ({
    url: `${ALAMAT_SITUS}${jalur}`,
    ...(tanggal ? { lastModified: tanggal } : {}),
  }));
}
