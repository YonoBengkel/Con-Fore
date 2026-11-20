// Baris kepala unduhan CSV. Setiap baris berawalan # supaya pembaca CSV bisa melewatinya, dan memuat
// sumber serta syarat penggunaannya, karena penyedia unduhan wajib menyampaikan syarat sumber ke
// penggunanya (PRD 9.3). Dipakai /api/csv/[chart_id] dan /api/csv/perkiraan/[kunci].

import type { MetaSeri, Sumber } from "./data";
import { labelSeri } from "./konten.ts";

/** Satu baris komentar: tanpa baris baru di dalamnya. */
export const komentar = (teks: string) => `# ${teks.replace(/\s+/g, " ").trim()}`;

/** Nama, satuan, label, dan sitasi setiap seri, lalu kalimat atribusi dan syarat setiap sumbernya. */
export function kepalaSumber(seriIds: string[], meta: MetaSeri[], sumber: Sumber[]): string[] {
  const kepala: string[] = [];
  const sumberDipakai = new Set<string>();
  for (const seri of seriIds) {
    const m = meta.find((x) => x.series_id === seri);
    if (!m) continue;
    sumberDipakai.add(m.source_id);
    kepala.push(komentar(`${seri}: ${m.name_id} (${m.unit}); ${labelSeri(m)}`));
    kepala.push(komentar(`Sitasi: ${m.citation}`));
  }
  for (const id of sumberDipakai) {
    const s = sumber.find((x) => x.source_id === id);
    if (!s) continue;
    kepala.push(komentar(`Atribusi ${s.name}: ${s.attribution_text}`));
    kepala.push(komentar(`Syarat penggunaan: ${s.license} ${s.terms_url}`));
  }
  return kepala;
}
