// GET /api/health: dipanggil cron-job.org setiap hari (ARCHITECTURE 4.2 dan 4.9).
// Wajib header x-health-token. 503 bila run sukses terakhir lebih dari 36 jam lalu atau Supabase
// tidak terbaca. Tidak pernah di-cache di CDN; pembacaan site_status boleh di-cache 60 detik.

import { bacaStatus } from "@/lib/data";
import { cocokRahasia } from "@/lib/rahasia";

export const dynamic = "force-dynamic";

const BATAS_JAM = 36;
const TANPA_CACHE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const token = process.env.HEALTH_TOKEN?.trim();
  if (!token) {
    return Response.json({ status: "belum_dikonfigurasi" }, { status: 503, headers: TANPA_CACHE });
  }
  if (!cocokRahasia(request.headers.get("x-health-token"), token)) {
    return Response.json({ status: "ditolak" }, { status: 401, headers: TANPA_CACHE });
  }

  let s;
  try {
    s = await bacaStatus(60);
  } catch {
    return Response.json({ status: "supabase_gagal" }, { status: 503, headers: TANPA_CACHE });
  }

  const umurJam = (Date.now() - Date.parse(s.last_success_at)) / 3_600_000;
  const sehat = Number.isFinite(umurJam) && umurJam <= BATAS_JAM;
  return Response.json(
    {
      status: sehat ? "ok" : "basi",
      last_success_at: s.last_success_at,
      last_run_status: s.last_run_status,
      umur_jam: Math.round(umurJam * 10) / 10,
      stale_sources: s.stale_sources,
    },
    { status: sehat ? 200 : 503, headers: TANPA_CACHE },
  );
}
