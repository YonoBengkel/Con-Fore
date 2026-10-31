// Perbandingan header rahasia dengan waktu tetap, supaya panjang atau isinya tidak bocor lewat waktu.

import { createHash, timingSafeEqual } from "node:crypto";

export function cocokRahasia(diberikan: string | null, seharusnya: string | undefined): boolean {
  if (!diberikan || !seharusnya) return false;
  const a = createHash("sha256").update(diberikan).digest();
  const b = createHash("sha256").update(seharusnya).digest();
  return timingSafeEqual(a, b);
}
