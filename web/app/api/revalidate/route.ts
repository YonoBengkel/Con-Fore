// POST /api/revalidate: dipanggil pipeline setelah publikasi (ARCHITECTURE 4.2 dan 4.10).
// Wajib header x-revalidate-secret yang sama dengan REVALIDATE_SECRET.
// Memakai revalidateTag dengan profil "max" (basi lalu diperbarui di latar), bukan revalidatePath:
// revalidatePath langsung membuang cache, sehingga bila Supabase gagal tepat sesudahnya, pengunjung
// mendapat error 500, bukan halaman terakhir yang baik.

import { revalidateTag } from "next/cache";
import { TAG_SUPABASE } from "@/lib/data";
import { cocokRahasia } from "@/lib/rahasia";

export const dynamic = "force-dynamic";

const TANPA_CACHE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const rahasia = process.env.REVALIDATE_SECRET?.trim();
  if (!rahasia) {
    return Response.json({ ok: false, kode: "belum_dikonfigurasi" }, { status: 503, headers: TANPA_CACHE });
  }
  if (!cocokRahasia(request.headers.get("x-revalidate-secret"), rahasia)) {
    return Response.json({ ok: false, kode: "ditolak" }, { status: 401, headers: TANPA_CACHE });
  }
  revalidateTag(TAG_SUPABASE, "max");
  return Response.json({ ok: true, kode: "direvalidasi" }, { headers: TANPA_CACHE });
}
