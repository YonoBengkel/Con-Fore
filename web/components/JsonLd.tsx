// Data terstruktur JSON-LD sebagai tag script biasa, bukan next/script, karena isinya data dan bukan
// kode (panduan JSON-LD Next.js). Isinya dibuat di web/lib/jsonld.ts.

import { teksJsonLd } from "@/lib/jsonld";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: teksJsonLd(data) }} />;
}
