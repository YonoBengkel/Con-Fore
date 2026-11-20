// Daftar halaman untuk mesin pencari: hanya halaman yang ditautkan situs. lastModified mengikuti kapan isi
// halaman berubah (angka baru atau perkiraan baru), dengan aturan yang sama seperti dateModified di
// JSON-LD (web/lib/jsonld.ts). /metode tanpa tanggal, karena isinya hanya berubah lewat kode.

import type { MetadataRoute } from "next";
import { bacaNilai, bacaRamalan } from "@/lib/data";
import { tanggalUbah, terbaru } from "@/lib/jsonld";
import { SERI_DITAUTKAN } from "@/lib/konten";
import { TARGET_PREDIKSI } from "@/lib/prediksi";
import { ALAMAT_SITUS } from "@/lib/situs";
import { SERI_SEGITIGA } from "@/lib/skor";

// 6 jam, sama dengan halaman; /api/revalidate ikut menandainya basi lewat tag Supabase.
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [nilai, ramalan] = await Promise.all([bacaNilai(), bacaRamalan()]);
  const ubah = new Map(nilai.map((n) => [n.series_id, tanggalUbah(n)]));
  const seri = [...new Set(SERI_DITAUTKAN)];
  const halaman: [string, string | undefined][] = [
    ["", terbaru([...seri, ...Object.values(SERI_SEGITIGA)].map((s) => ubah.get(s)))],
    [
      "/prediksi",
      terbaru([
        ...ramalan.filter((b) => b.is_main).map((b) => b.origin_date),
        ...TARGET_PREDIKSI.flatMap((t) => [ubah.get(t.seri), ubah.get(t.imf)]),
      ]),
    ],
    ["/metode", undefined],
    ...seri.map((id): [string, string | undefined] => [`/indikator/${id}`, ubah.get(id)]),
  ];
  return halaman.map(([jalur, tanggal]) => ({
    url: `${ALAMAT_SITUS}${jalur}`,
    ...(tanggal ? { lastModified: tanggal } : {}),
  }));
}
