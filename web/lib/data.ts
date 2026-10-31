// Pembacaan tabel public Supabase lewat Data API (PostgREST), hanya di server.
// Kunci dibaca dari variabel environment server (tanpa awalan NEXT_PUBLIC_), jadi tidak pernah
// sampai ke browser. Setiap kegagalan melempar error supaya Vercel tetap menyajikan halaman
// terakhir yang baik (ARCHITECTURE 4.10). Pesan error tidak memuat URL maupun kunci.

export type Sumber = {
  source_id: string;
  name: string;
  url: string;
  terms_url: string;
  license: string;
  attribution_text: string;
};

export type MetaSeri = {
  series_id: string;
  source_id: string;
  country: string;
  name_id: string;
  unit: string;
  concept: string;
  frequency: "A" | "Q" | "M" | "D";
  citation: string;
  last_period: string | null;
  last_release_date: string | null;
  next_release_date: string | null;
};

export type NilaiTerakhir = {
  series_id: string;
  period: string;
  value: number;
  previous_value: number | null;
  release_date: string | null;
  seen_date: string | null;
  source_id: string;
  is_stale: boolean;
};

export type Titik = [string, number];

export type Grafik = {
  chart_id: string;
  series_ids: string[];
  points: Record<string, Titik[]>;
  updated_at: string;
};

export type Target = {
  series_id: string;
  year: number;
  target_kind: "apbn" | "pmk" | "rpjmn";
  value: number | null;
  lower: number | null;
  upper: number | null;
  document: string;
  url: string;
  last_verified: string;
  verification: "dokumen" | "berita";
};

export type Rilis = {
  series_id: string;
  ref_period: string;
  release_date: string;
  calendar_source: string;
};

export type StatusSitus = {
  id: 1;
  last_success_at: string;
  last_run_status: "ok" | "partial" | "failed";
  stale_sources: string[];
};

/** Sama dengan `export const revalidate` di halaman: 6 jam. */
export const REVALIDATE_DETIK = 21600;

/**
 * Tag pada setiap pembacaan Supabase. /api/revalidate memakai revalidateTag(TAG_SUPABASE, "max"),
 * yang menandai halaman basi tanpa langsung membuangnya: pengunjung tetap mendapat halaman lama
 * selama halaman baru dirender di latar, dan bila render itu gagal, halaman lama dipertahankan.
 */
export const TAG_SUPABASE = "supabase";

/** Id seri dan grafik hanya huruf kecil, angka, dan garis bawah. */
export const POLA_ID = /^[a-z0-9_]{1,64}$/;

async function baca<T>(
  tabel: string,
  query: string,
  opsi: { wajib?: boolean; revalidate?: number } = {},
): Promise<T[]> {
  const alamat = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const kunci = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!alamat || !kunci) {
    throw new Error("SUPABASE_URL atau SUPABASE_PUBLISHABLE_KEY belum diisi");
  }
  let jawaban: Response;
  try {
    jawaban = await fetch(`${alamat}/rest/v1/${tabel}?${query}`, {
      headers: { apikey: kunci, Accept: "application/json" },
      next: { revalidate: opsi.revalidate ?? REVALIDATE_DETIK, tags: [TAG_SUPABASE] },
    });
  } catch (e) {
    throw new Error(`Gagal menghubungi Supabase saat membaca ${tabel} (${(e as Error).name})`);
  }
  if (!jawaban.ok) {
    throw new Error(`Gagal membaca ${tabel}: HTTP ${jawaban.status}`);
  }
  const baris = (await jawaban.json()) as T[];
  if (!Array.isArray(baris)) throw new Error(`Jawaban ${tabel} bukan daftar`);
  if (opsi.wajib && baris.length === 0) {
    throw new Error(`Tabel wajib ${tabel} kosong`);
  }
  return baris;
}

// Wajib: tanpa baris sumber, /sumber dan setiap CSV kehilangan atribusi yang diwajibkan (PRD 9.3).
export const bacaSumber = () =>
  baca<Sumber>("sources", "select=*&order=source_id", { wajib: true });

export const bacaMeta = () =>
  baca<MetaSeri>("series_meta", "select=*&order=series_id", { wajib: true });

export const bacaNilai = () =>
  baca<NilaiTerakhir>("latest_values", "select=*&order=series_id", { wajib: true });

export const bacaTarget = () =>
  baca<Target>("targets", "select=*&order=year.desc,series_id,target_kind");

export const bacaKalender = () =>
  baca<Rilis>("release_calendar", "select=*&order=release_date,series_id");

export async function bacaStatus(revalidate?: number): Promise<StatusSitus> {
  const [status] = await baca<StatusSitus>("site_status", "select=*&id=eq.1", {
    wajib: true,
    revalidate,
  });
  return status;
}

/**
 * Hanya grafik yang diminta, supaya jawaban kecil (seri harian berisi ribuan titik). `wajib` untuk
 * halaman yang tidak berguna tanpa grafik (beranda); halaman satu seri boleh tanpa grafik.
 */
export async function bacaGrafik(ids: string[], wajib = false): Promise<Map<string, Grafik>> {
  const aman = [...new Set(ids)].filter((id) => POLA_ID.test(id));
  if (!aman.length) return new Map();
  const baris = await baca<Grafik>("chart_series", `select=*&chart_id=in.(${aman.join(",")})`, {
    wajib,
  });
  return new Map(baris.map((g) => [g.chart_id, g]));
}

export async function bacaIdGrafik(): Promise<string[]> {
  const baris = await baca<{ chart_id: string }>("chart_series", "select=chart_id&order=chart_id", {
    wajib: true,
  });
  return baris.map((b) => b.chart_id);
}

/** Titik satu seri dari grafiknya, terurut menurut periode. */
export function titikSeri(grafik: Map<string, Grafik>, seri: string): Titik[] {
  return grafik.get(seri)?.points[seri] ?? [];
}
