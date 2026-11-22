// Logika globe di halaman depan (DESIGN.md, Halaman depan dan globe): data negara, cara globe bergerak menurut
// perangkat, dan uji apakah titik di layar mengenai Indonesia. Kode yang menggambar ke kanvas ada di
// lib/gambar-globe.ts, supaya bagian ini bisa diuji tanpa browser. Data negaranya Natural Earth 1:110m (domain
// publik) lewat paket world-atlas.

import { geoCentroid, geoContains, type GeoObjek, type Titik } from "d3-geo";
import { feature, mesh, type Fitur, type KumpulanFitur, type Topologi } from "topojson-client";

/** Kode ISO 3166-1 numerik Indonesia, yang dipakai world-atlas sebagai id negara. */
export const ID_INDONESIA = "360";

/** Kecepatan putar globe: 4 derajat per detik, jadi satu putaran penuh 90 detik. */
export const DERAJAT_PER_DETIK = 4;

/** Selang terpanjang yang dihitung per bingkai, supaya globe tidak melompat sesudah tab dibuka lagi. */
const SELANG_MAKS = 100;

export type Mode = {
  /** Globe berputar pelan, dan berhenti saat kursor atau fokus keyboard ada di atasnya. */
  berputar: boolean;
  /** Indonesia terangkat sejak awal, karena tidak ada kursor untuk menyorotnya. */
  angkatAwal: boolean;
};

/**
 * Di komputer (ada kursor) globe berputar, kecuali pembaca memilih kurangi animasi. Di HP globe diam menghadap
 * Indonesia yang sudah terangkat, karena negara di globe yang berputar sulit diketuk.
 */
export function pilihMode(adaKursor: boolean, kurangiGerak: boolean): Mode {
  return { berputar: adaKursor && !kurangiGerak, angkatAwal: !adaKursor };
}

/** Sudut putar (bujur pada rotasi d3, dalam derajat) sesudah selang waktu dalam milidetik. */
export function putar(sudut: number, selangMs: number): number {
  const selang = Math.min(Math.max(selangMs, 0), SELANG_MAKS);
  return (sudut + (DERAJAT_PER_DETIK * selang) / 1000) % 360;
}

/** Kemajuan angkat Indonesia (0 di permukaan, 1 terangkat penuh) sesudah selang waktu, menuju arah `naik`. */
export function langkahAngkat(kemajuan: number, naik: boolean, selangMs: number, durasiMs: number): number {
  if (durasiMs <= 0) return naik ? 1 : 0;
  const langkah = selangMs / durasiMs;
  return naik ? Math.min(1, kemajuan + langkah) : Math.max(0, kemajuan - langkah);
}

/** Selisih sudut terpendek dari `dari` ke `ke`, antara -180 dan 180 derajat. */
export function selisihSudut(dari: number, ke: number): number {
  return ((((ke - dari) % 360) + 540) % 360) - 180;
}

export type DataGlobe = {
  indonesia: Fitur;
  /** Semua negara selain Indonesia. */
  lainnya: KumpulanFitur;
  /** Garis batas antarnegara, tanpa garis pantai. */
  batas: GeoObjek;
  /** Titik tengah Indonesia [bujur, lintang], arah hadap globe. */
  pusat: Titik;
};

export function siapkanData(dunia: Topologi): DataGlobe {
  const semua = feature(dunia, dunia.objects.countries).features;
  const indonesia = semua.find((negara) => negara.id === ID_INDONESIA);
  if (!indonesia) throw new Error("Indonesia tidak ada di data peta");
  return {
    indonesia,
    lainnya: { type: "FeatureCollection", features: semua.filter((negara) => negara !== indonesia) },
    batas: mesh(dunia, dunia.objects.countries, (a, b) => a !== b),
    pusat: geoCentroid(indonesia),
  };
}

/**
 * Apakah titik layar mengenai Indonesia. `kebalikan` mengubah titik layar menjadi [bujur, lintang], atau null bila
 * titiknya di luar bola. Empat titik di sekitarnya sejauh `toleransi` piksel ikut diperiksa, supaya pulau kecil
 * tetap mudah disentuh, kecuali bila titiknya sendiri jatuh di daratan negara lain.
 *
 * Saat Indonesia digambar `angkat` piksel lebih tinggi, titik dianggap kena bila mengenai posisi dasar atau posisi
 * terangkatnya. Tanpa itu, titik di bawah pantai selatan kena sebelum Indonesia terangkat lalu meleset sesudahnya,
 * sehingga kursor berkedip dan kliknya gagal.
 */
export function kenaIndonesia(
  data: Pick<DataGlobe, "indonesia" | "lainnya">,
  kebalikan: (titik: Titik) => Titik | null,
  [x, y]: Titik,
  toleransi: number,
  angkat = 0,
): boolean {
  return kenaDi(data, kebalikan, [x, y], toleransi) || (angkat > 0 && kenaDi(data, kebalikan, [x, y + angkat], toleransi));
}

function kenaDi(
  { indonesia, lainnya }: Pick<DataGlobe, "indonesia" | "lainnya">,
  kebalikan: (titik: Titik) => Titik | null,
  [x, y]: Titik,
  toleransi: number,
): boolean {
  const pusat = kebalikan([x, y]);
  if (pusat !== null && geoContains(indonesia, pusat)) return true;
  if (toleransi <= 0) return false;
  const sekitar: Titik[] = [
    [toleransi, 0],
    [-toleransi, 0],
    [0, toleransi],
    [0, -toleransi],
  ];
  const dekat = sekitar.some(([dx, dy]) => {
    const titik = kebalikan([x + dx, y + dy]);
    return titik !== null && geoContains(indonesia, titik);
  });
  // Daratan negara tetangga di dekat perbatasan tetap milik negara itu, walau Indonesia ada dalam jangkauan toleransi.
  return dekat && !(pusat !== null && geoContains(lainnya, pusat));
}
