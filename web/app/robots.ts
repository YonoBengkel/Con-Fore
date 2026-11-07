// /api/ ditutup untuk perayap: isinya unduhan CSV dan route mesin, sedangkan angkanya sudah ada di halaman.

import type { MetadataRoute } from "next";
import { ALAMAT_SITUS } from "@/lib/situs";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${ALAMAT_SITUS}/sitemap.xml`,
  };
}
