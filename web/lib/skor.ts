// Aturan skor segitiga (PRD 4.2). Fungsi murni tanpa impor, supaya bisa dites langsung dengan
// `node --test` dan dipakai di server maupun browser.

export type Dimensi = "pertumbuhan" | "harga" | "kerja";
export type Skor = Record<Dimensi, number>;
export type NilaiTahun = { pertumbuhan: number; inflasi: number; pengangguran: number };

/** Seri tahunan IMF WEO yang mengisi segitiga. */
export const SERI_SEGITIGA = {
  pertumbuhan: "idn_gdp_growth_a",
  inflasi: "idn_cpi_eop_a",
  pengangguran: "idn_unemp_a",
} as const;

/** Rentang tahun pembanding lensa masa lalu. */
export const TAHUN_AWAL = 2000;
export const TAHUN_AKHIR = 2025;
/** Patokan harga stabil: jarak inflasi akhir tahun ke angka ini. */
export const PATOKAN_INFLASI = 2.5;
/** Lensa target: skor turun sebanyak ini untuk setiap 1 poin persen di luar zona. */
export const POIN_PER_PP = 25;

const TOLERANSI = 1e-9;

/**
 * Persentil x di antara nilai pembanding (makin besar makin baik): persen tahun yang lebih buruk,
 * ditambah separuh tahun yang sama nilainya (tahun itu sendiri ikut dihitung sama).
 */
export function persentil(x: number, pembanding: number[]): number {
  if (!pembanding.length) return NaN;
  let buruk = 0;
  let sama = 0;
  for (const p of pembanding) {
    if (Math.abs(p - x) <= TOLERANSI) sama++;
    else if (p < x) buruk++;
  }
  return (100 * (buruk + sama / 2)) / pembanding.length;
}

/** Ubah nilai mentah menjadi "kebaikan": makin besar makin baik untuk ketiga dimensi. */
function kebaikan(n: NilaiTahun): Skor {
  return {
    pertumbuhan: n.pertumbuhan,
    harga: -Math.abs(n.inflasi - PATOKAN_INFLASI),
    kerja: -n.pengangguran,
  };
}

/** Lensa masa lalu: persentil tahun itu dibanding tahun TAHUN_AWAL sampai TAHUN_AKHIR. */
export function skorMasaLalu(tahun: number, data: Map<number, NilaiTahun>): Skor | null {
  const ini = data.get(tahun);
  if (!ini) return null;
  const acuan = [...data.entries()]
    .filter(([t]) => t >= TAHUN_AWAL && t <= TAHUN_AKHIR)
    .map(([, n]) => kebaikan(n));
  if (!acuan.length) return null;
  const k = kebaikan(ini);
  return {
    pertumbuhan: persentil(k.pertumbuhan, acuan.map((a) => a.pertumbuhan)),
    harga: persentil(k.harga, acuan.map((a) => a.harga)),
    kerja: persentil(k.kerja, acuan.map((a) => a.kerja)),
  };
}

/** Zona target satu tahun: pertumbuhan minimal, titik tengah sasaran inflasi, batas atas TPT. */
export type ZonaTarget = { pertumbuhanMin: number; inflasiTengah: number; tptBatasAtas: number };

/** Jarak (poin persen) di luar zona target; 0 berarti di dalam zona. */
export function jarakTarget(n: NilaiTahun, z: ZonaTarget): Skor {
  return {
    pertumbuhan: Math.max(0, z.pertumbuhanMin - n.pertumbuhan),
    harga: Math.max(0, Math.abs(n.inflasi - z.inflasiTengah) - 1),
    kerja: Math.max(0, n.pengangguran - z.tptBatasAtas),
  };
}

/** Lensa target: 100 di dalam zona, turun POIN_PER_PP per poin persen di luar zona, minimal 0. */
export function skorTarget(n: NilaiTahun, z: ZonaTarget): Skor {
  const j = jarakTarget(n, z);
  const skor = (x: number) => Math.max(0, 100 - POIN_PER_PP * x);
  return { pertumbuhan: skor(j.pertumbuhan), harga: skor(j.harga), kerja: skor(j.kerja) };
}

type BarisTarget = {
  series_id: string;
  year: number;
  target_kind: string;
  value: number | null;
  lower: number | null;
  upper: number | null;
};

/**
 * Zona target resmi untuk satu tahun: pertumbuhan dari APBN, sasaran inflasi dari PMK (± 1), TPT
 * dari batas atas APBN. null bila salah satunya belum ada, sehingga lensa target tidak tersedia.
 */
export function zonaTarget<T extends BarisTarget>(
  baris: T[],
  tahun: number,
): { zona: ZonaTarget; sumber: T[] } | null {
  const cari = (seri: string, jenis: string) =>
    baris.find((b) => b.series_id === seri && b.year === tahun && b.target_kind === jenis);
  const g = cari(SERI_SEGITIGA.pertumbuhan, "apbn");
  const i = cari(SERI_SEGITIGA.inflasi, "pmk");
  const u = cari(SERI_SEGITIGA.pengangguran, "apbn");
  const pertumbuhanMin = g?.value ?? g?.lower ?? null;
  const inflasiTengah =
    i?.value ?? (i?.lower != null && i?.upper != null ? (i.lower + i.upper) / 2 : null);
  const tptBatasAtas = u?.upper ?? u?.value ?? null;
  if (!g || !i || !u || pertumbuhanMin == null || inflasiTengah == null || tptBatasAtas == null) {
    return null;
  }
  return { zona: { pertumbuhanMin, inflasiTengah, tptBatasAtas }, sumber: [g, i, u] };
}

/** Gabungkan tiga seri tahunan menjadi peta tahun ke nilai, hanya tahun yang ketiganya ada. */
export function gabungTahunan(
  pertumbuhan: [string, number][],
  inflasi: [string, number][],
  pengangguran: [string, number][],
): Map<number, NilaiTahun> {
  const peta = (titik: [string, number][]) => new Map(titik.map(([p, v]) => [Number(p), v]));
  const i = peta(inflasi);
  const u = peta(pengangguran);
  const hasil = new Map<number, NilaiTahun>();
  for (const [t, v] of peta(pertumbuhan)) {
    const vi = i.get(t);
    const vu = u.get(t);
    if (Number.isInteger(t) && vi != null && vu != null) {
      hasil.set(t, { pertumbuhan: v, inflasi: vi, pengangguran: vu });
    }
  }
  return hasil;
}

/** Tahun terakhir yang punya ketiga nilai tahunan. */
export function tahunLengkap(data: Map<number, NilaiTahun>): number | null {
  const tahun = [...data.keys()];
  return tahun.length ? Math.max(...tahun) : null;
}
