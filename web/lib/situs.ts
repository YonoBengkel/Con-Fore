// Alamat produksi untuk sitemap dan robots. Vercel mengisi variabel ini saat build, termasuk domain sendiri
// bila nanti ada (PRD 9.2). Cadangannya untuk build lokal.
const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

export const ALAMAT_SITUS = `https://${domain || "con-fore.vercel.app"}`;

/** Deskripsi situs untuk metadata halaman dan JSON-LD WebSite di beranda. */
export const DESKRIPSI_SITUS =
  "Pertumbuhan, inflasi, dan pengangguran Indonesia dalam bahasa sehari-hari, diperbarui otomatis dari data publik. Situs independen, bukan situs resmi lembaga mana pun.";
