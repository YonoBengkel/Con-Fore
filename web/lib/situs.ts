// Alamat produksi untuk sitemap dan robots. Vercel mengisi variabel ini saat build, termasuk domain sendiri
// bila nanti ada (PRD 9.2). Cadangannya untuk build lokal.
const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

export const ALAMAT_SITUS = `https://${domain || "con-fore.vercel.app"}`;
