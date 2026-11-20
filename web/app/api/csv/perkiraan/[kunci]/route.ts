// GET /api/csv/perkiraan/[kunci]: unduhan CSV perkiraan satu target dari public.forecast_latest, semua
// cara, di-cache bersama halaman (ISR). Baris awal berawalan # menjelaskan kolomnya dan memuat sumber
// angka resmi yang diperkirakan beserta syaratnya (web/lib/csv.ts, PRD 9.3).

import { kepalaSumber, komentar } from "@/lib/csv";
import { bacaMeta, bacaRamalan, bacaSumber } from "@/lib/data";
import { NAMA_MODEL, TARGET_PREDIKSI } from "@/lib/prediksi";

// 6 jam, sama dengan halaman.
export const revalidate = 21600;
// Hanya tiga kunci target yang dibangun saat build: kunci lain langsung 404 tanpa menulis cache.
export const dynamicParams = false;

type Konteks = { params: Promise<{ kunci: string }> };

export function generateStaticParams() {
  return TARGET_PREDIKSI.map((t) => ({ kunci: t.kunci }));
}

export async function GET(_request: Request, { params }: Konteks) {
  const { kunci } = await params;
  const target = TARGET_PREDIKSI.find((t) => t.kunci === kunci);
  if (!target) {
    return new Response("Perkiraan tidak ditemukan.\n", { status: 404 });
  }
  const [ramalan, meta, sumber] = await Promise.all([bacaRamalan(), bacaMeta(), bacaSumber()]);
  const baris = ramalan
    .filter((b) => b.series_id === target.seri)
    .sort(
      (a, b) =>
        a.ref_period.localeCompare(b.ref_period) ||
        Number(b.is_main) - Number(a.is_main) ||
        a.model.localeCompare(b.model),
    );
  const cara = [...new Set(baris.map((b) => b.model))].sort();

  const kepala = [
    komentar(
      `Con-Fore, unduhan perkiraan ${target.judul.toLowerCase()}. Perkiraan Con-Fore, bukan angka resmi dan ` +
        "bukan nasihat keuangan. Situs independen, bukan situs resmi lembaga mana pun.",
    ),
    komentar("Kolom utama bernilai true untuk cara yang menjadi angka utama di situs."),
    komentar(
      "Batas bawah dan batas atas adalah rentang 80%: pada uji dengan data lama, sekitar 8 dari 10 angka resmi " +
        "di masa biasa jatuh di dalam rentang selebar itu. Kosong bila ujinya belum cukup.",
    ),
    ...cara.map((c) => komentar(`Cara ${c}: ${NAMA_MODEL[c] ?? c}`)),
    komentar("Angka resmi yang diperkirakan:"),
    ...kepalaSumber([target.seri], meta, sumber),
    ...(baris.length ? [] : [komentar("Perkiraan belum tersedia.")]),
  ];
  const isi = [
    "series_id,periode,cara,utama,perkiraan,batas_bawah,batas_atas,dihitung",
    ...baris.map((b) =>
      [b.series_id, b.ref_period, b.model, b.is_main, b.point, b.lo80 ?? "", b.hi80 ?? "", b.origin_date.slice(0, 10)].join(","),
    ),
  ];

  return new Response(`${kepala.join("\n")}\n${isi.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="con-fore-perkiraan-${target.kunci}.csv"`,
    },
  });
}
