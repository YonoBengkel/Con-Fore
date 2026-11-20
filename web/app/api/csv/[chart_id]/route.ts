// GET /api/csv/[chart_id]: unduhan CSV dari public.chart_series, di-cache bersama halaman (ISR).
// Baris awal berawalan # memuat sumber dan syarat penggunaan (web/lib/csv.ts, PRD 9.3).

import { kepalaSumber, komentar } from "@/lib/csv";
import { POLA_ID, bacaGrafik, bacaIdGrafik, bacaMeta, bacaSumber } from "@/lib/data";
import { SERI_DITAUTKAN } from "@/lib/konten";

// 6 jam, sama dengan halaman.
export const revalidate = 21600;
// Hanya id yang dibangun saat build, sama dengan /indikator/[id]: id karangan tidak menulis cache.
export const dynamicParams = false;

type Konteks = { params: Promise<{ chart_id: string }> };

export async function generateStaticParams() {
  const ids = new Set([...(await bacaIdGrafik()), ...SERI_DITAUTKAN]);
  return [...ids].map((chart_id) => ({ chart_id }));
}

export async function GET(_request: Request, { params }: Konteks) {
  const { chart_id } = await params;
  if (!POLA_ID.test(chart_id)) {
    return new Response("Grafik tidak ditemukan.\n", { status: 404 });
  }
  const [grafik, meta, sumber] = await Promise.all([bacaGrafik([chart_id]), bacaMeta(), bacaSumber()]);
  const g = grafik.get(chart_id);
  if (!g) {
    return new Response("Grafik tidak ditemukan.\n", { status: 404 });
  }

  const kepala = [
    komentar(`Con-Fore, unduhan grafik ${chart_id}. Situs independen, bukan situs resmi lembaga mana pun.`),
    ...kepalaSumber(g.series_ids, meta, sumber),
    komentar(`Diterbitkan Con-Fore: ${g.updated_at}`),
  ];

  const baris = ["series_id,periode,nilai"];
  for (const seri of g.series_ids) {
    for (const [periode, nilai] of g.points[seri] ?? []) {
      baris.push(`${seri},${periode},${nilai}`);
    }
  }

  return new Response(`${kepala.join("\n")}\n${baris.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="con-fore-${chart_id}.csv"`,
    },
  });
}
