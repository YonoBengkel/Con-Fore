// Format angka, periode, dan tanggal untuk pembaca Indonesia. Tidak memakai waktu sekarang,
// jadi hasil render selalu sama untuk data yang sama (ARCHITECTURE 4.10).

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const ROMAWI = ["I", "II", "III", "IV"];

const pemformat = new Map<number, Intl.NumberFormat>();

export function angka(n: number, desimal: number): string {
  let f = pemformat.get(desimal);
  if (!f) {
    f = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: desimal,
      maximumFractionDigits: desimal,
    });
    pemformat.set(desimal, f);
  }
  return f.format(n);
}

/** Jumlah desimal yang wajar menurut konsep dan besar angka. */
export function desimalUntuk(n: number, konsep: string): number {
  if (konsep === "rate" || konsep === "round_rate") return Math.abs(n) >= 1000 ? 0 : 2; // >= 1000: jumlah orang per ronde
  if (konsep !== "level") return 1;
  const besar = Math.abs(n);
  return besar >= 1000 ? 0 : besar >= 10 ? 1 : 4;
}

/** Nilai seri dengan satuannya, misalnya "5,1%" atau "18.143 rupiah per dolar AS". */
export function nilaiSeri(n: number, satuan: string, konsep: string): string {
  if (Math.abs(n) >= 1e12) return `${angka(n / 1e12, 0)} triliun ${satuan}`;
  const teks = angka(n, desimalUntuk(n, konsep));
  return satuan.startsWith("%") ? `${teks}%` : `${teks} ${satuan}`;
}

/** Angka utama tanpa satuan panjang, untuk kartu: "5,1%" atau "18.143". */
export function nilaiPendek(n: number, satuan: string, konsep: string): string {
  if (Math.abs(n) >= 1e12) return `${angka(n / 1e12, 0)} triliun`;
  const teks = angka(n, desimalUntuk(n, konsep));
  return satuan.startsWith("%") ? `${teks}%` : teks;
}

/** "2026-Q2" -> "kuartal II 2026", "2026-09" -> "September 2026", "2026-10-29" -> "29 Oktober 2026". */
export function periode(p: string): string {
  let m = /^(\d{4})-Q([1-4])$/.exec(p);
  if (m) return `kuartal ${ROMAWI[Number(m[2]) - 1]} ${m[1]}`;
  m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m) return `${BULAN[Number(m[2]) - 1]} ${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p);
  if (m) return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
  return p;
}

/** Tanggal "2026-10-30" (atau awal timestamp) -> "30 Oktober 2026". */
export function tanggal(iso: string | null): string {
  if (!iso) return "-";
  return periode(iso.slice(0, 10));
}

/** Timestamp UTC -> "30 Oktober 2026 pukul 17.15 WIB". */
export function waktuWIB(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3600 * 1000);
  if (Number.isNaN(d.getTime())) return iso;
  const jam = String(d.getUTCHours()).padStart(2, "0");
  const menit = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()} pukul ${jam}.${menit} WIB`;
}

const PEMBANDING: Record<string, string> = {
  A: "tahun sebelumnya",
  Q: "kuartal sebelumnya",
  M: "bulan sebelumnya",
  D: "hari kurs sebelumnya",
};

/** Perubahan dari nilai sebelumnya, dalam kalimat pendek. */
export function perubahan(
  sekarang: number,
  sebelum: number | null,
  satuan: string,
  konsep: string,
  frekuensi: string,
): string | null {
  if (sebelum == null) return null;
  // TPT per ronde Sakernas: pipeline mengisi previous_value dengan ronde bulan yang sama tahun
  // sebelumnya (ARCHITECTURE 4.3), karena ronde yang berbeda bulan tidak sepadan.
  const banding =
    konsep === "round_rate" ? "ronde yang sama tahun lalu" : (PEMBANDING[frekuensi] ?? "periode sebelumnya");
  if (satuan.startsWith("%")) {
    const d = konsep === "rate" || konsep === "round_rate" ? 2 : 1;
    // Dihitung dari angka yang tampil, supaya kalimatnya selalu cocok dengan angka di kartu.
    const selisih = Number(sekarang.toFixed(d)) - Number(sebelum.toFixed(d));
    if (Math.abs(selisih) < 0.5 * 10 ** -d) {
      return `${sekarang === sebelum ? "sama" : "hampir sama"} dengan ${banding}`;
    }
    return `${selisih > 0 ? "naik" : "turun"} ${angka(Math.abs(selisih), d)} poin persen dari ${banding} (${nilaiPendek(sebelum, satuan, konsep)})`;
  }
  if (sebelum === 0) return null;
  const persen = ((sekarang - sebelum) / Math.abs(sebelum)) * 100;
  if (Math.abs(persen) < 0.05) return `hampir sama dengan ${banding}`;
  return `${persen > 0 ? "naik" : "turun"} ${angka(Math.abs(persen), 1)}% dari ${banding}`;
}

/** Awal kalimat perubahan untuk panel yang sempit: "naik 0,2 poin persen". */
export function perubahanRingkas(...args: Parameters<typeof perubahan>): string | null {
  return perubahan(...args)?.split(" dari ")[0] ?? null;
}
