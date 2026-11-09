// Daftar halaman untuk mesin pencari. Tetap, tanpa membaca Supabase: hanya halaman yang ditautkan situs.

import type { MetadataRoute } from "next";
import { SERI_DITAUTKAN } from "@/lib/konten";
import { ALAMAT_SITUS } from "@/lib/situs";

export default function sitemap(): MetadataRoute.Sitemap {
  const indikator = [...new Set(SERI_DITAUTKAN)].map((id) => `/indikator/${id}`);
  return ["", "/prediksi", "/metode", ...indikator].map((jalur) => ({
    url: `${ALAMAT_SITUS}${jalur}`,
  }));
}
