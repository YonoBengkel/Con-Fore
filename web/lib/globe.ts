// Logika globe di halaman depan (DESIGN.md, Halaman depan dan globe): data negara, cara globe bergerak menurut
// perangkat dan seretan, jalur yang digambar, dan uji apakah titik di layar mengenai Indonesia. Kode yang memegang
// kanvas ada di lib/gambar-globe.ts, supaya bagian ini bisa diuji tanpa browser. Data negaranya Natural Earth 1:110m
// (domain publik) lewat paket world-atlas.

import { geoCentroid, geoContains, geoInterpolate, type GeoObjek, type Titik } from "d3-geo";
import { feature, mesh, type Fitur, type KumpulanFitur, type Topologi } from "topojson-client";

/** Kode ISO 3166-1 numerik Indonesia, yang dipakai world-atlas sebagai id negara. */
export const ID_INDONESIA = "360";

/** Kecepatan putar globe: 4 derajat per detik, jadi satu putaran penuh 90 detik. */
export const DERAJAT_PER_DETIK = 4;

/** Selang terpanjang yang dihitung per bingkai, supaya globe tidak melompat sesudah tab dibuka lagi. */
const SELANG_MAKS = 100;

/** Kemiringan terjauh saat globe diseret ke atas atau ke bawah, supaya utara selalu di atas. */
export const MIRING_MAKS = 70;

/** Lemparan melambat dengan tetapan waktu 325 ms, jadi lajunya tinggal sepertiga setiap 325 ms. */
const TETAPAN_LEMPAR = 325;

/** Laju lepas dibaca dari jejak 100 ms terakhir. */
const JENDELA_JEJAK = 100;

const RAD = Math.PI / 180;

/** Ruas terpanjang garis yang digambar, supaya garisnya tetap mengikuti lengkung bola. */
const RUAS_MAKS = 2.5 * RAD;

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

const batasiSelang = (selangMs: number) => Math.min(Math.max(selangMs, 0), SELANG_MAKS);

/** Arah putaran otomatis: 1 ke kanan, seperti Bumi, dan -1 ke kiri. */
export type ArahPutar = 1 | -1;

/** Sudut putar (bujur pada rotasi d3, dalam derajat) sesudah selang waktu dalam milidetik. */
export function putar(sudut: number, selangMs: number, arah: ArahPutar = 1): number {
  return (sudut + (arah * DERAJAT_PER_DETIK * batasiSelang(selangMs)) / 1000) % 360;
}

/** Arah hadap globe, yaitu sudut rotasi d3 [putar, miring] dalam derajat. */
export type Hadap = [number, number];

const batasiMiring = (miring: number) => Math.min(MIRING_MAKS, Math.max(-MIRING_MAKS, miring));

/** Arah hadap dengan titik ini di tengah bola, sejauh batas kemiringan. */
export function hadapKe([bujur, lintang]: Titik): Hadap {
  return [-bujur, batasiMiring(-lintang)];
}

/**
 * Arah hadap sesudah globe diseret sejauh (dx, dy) piksel: permukaan di tengah bola bergerak sejauh kursor atau
 * jarinya, ke arah yang sama. Di bola yang miring, lingkaran lintang di tengahnya lebih kecil, jadi putarannya lebih
 * besar.
 */
export function seret([sudut, miring]: Hadap, dx: number, dy: number, jejari: number): Hadap {
  const derajatPerPiksel = 180 / (Math.PI * jejari);
  return [
    (sudut + (dx * derajatPerPiksel) / Math.cos(miring * RAD)) % 360,
    batasiMiring(miring - dy * derajatPerPiksel),
  ];
}

/** Satu posisi kursor atau jari selama menyeret, dalam piksel, dengan waktunya dalam milidetik. */
export type Jejak = { waktu: number; x: number; y: number };

/** Laju mendatar dan tegak dalam piksel per detik. */
export type Laju = [number, number];

/** Laju saat dilepas. Nol bila kursor atau jarinya berhenti dulu sebelum dilepas. */
export function lajuLepas(jejak: Jejak[], waktu: number): Laju {
  const baru = jejak.filter((j) => waktu - j.waktu <= JENDELA_JEJAK);
  if (baru.length < 2) return [0, 0];
  const awal = baru[0];
  const akhir = baru[baru.length - 1];
  const detik = Math.max(waktu - awal.waktu, 1) / 1000;
  return [(akhir.x - awal.x) / detik, (akhir.y - awal.y) / detik];
}

/** Satu bingkai lemparan: jarak yang ditempuh dalam piksel, dan laju sesudah melambat. */
export function langkahLempar([vx, vy]: Laju, selangMs: number): { dx: number; dy: number; laju: Laju } {
  const sisa = Math.exp(-batasiSelang(selangMs) / TETAPAN_LEMPAR);
  const tempuh = (TETAPAN_LEMPAR / 1000) * (1 - sisa);
  return { dx: vx * tempuh, dy: vy * tempuh, laju: [vx * sisa, vy * sisa] };
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

/** Garis-garis sebuah geometri (cincin negara, batas, atau kisi) sebagai vektor satuan x, y, z yang berurutan. */
export function vektorDari({ type, coordinates }: GeoObjek): Float64Array[] {
  const garis = type === "MultiPolygon" ? (coordinates as Titik[][][]).flat() : (coordinates as Titik[][]);
  return garis.map((titik) => Float64Array.from(rapatkan(titik)));
}

/** Vektor satu garis. Ruas yang panjang dibagi mengikuti lingkaran besar, sama seperti cara d3 membaca garisnya. */
function rapatkan(garis: Titik[]): number[] {
  const hasil: number[] = [];
  let lalu: [number, number, number] | null = null;
  for (const [i, titik] of garis.entries()) {
    const ini = keVektor(titik);
    if (lalu && lalu[0] * ini[0] + lalu[1] * ini[1] + lalu[2] * ini[2] < Math.cos(RUAS_MAKS)) {
      const antara = geoInterpolate(garis[i - 1], titik);
      const bagian = Math.ceil(antara.distance / RUAS_MAKS);
      for (let k = 1; k < bagian; k++) hasil.push(...keVektor(antara(k / bagian)));
    }
    hasil.push(...ini);
    lalu = ini;
  }
  return hasil;
}

function keVektor([bujur, lintang]: Titik): [number, number, number] {
  const datar = Math.cos(lintang * RAD);
  return [datar * Math.cos(bujur * RAD), datar * Math.sin(bujur * RAD), Math.sin(lintang * RAD)];
}

/** Arah hadap, titik tengah, dan jejari bola di layar untuk satu bingkai. */
export type Kamera = {
  cosPutar: number;
  sinPutar: number;
  cosMiring: number;
  sinMiring: number;
  pusat: number;
  jejari: number;
};

export function pasangKamera([sudut, miring]: Hadap, pusat: number, jejari: number): Kamera {
  return {
    cosPutar: Math.cos(sudut * RAD),
    sinPutar: Math.sin(sudut * RAD),
    cosMiring: Math.cos(miring * RAD),
    sinMiring: Math.sin(miring * RAD),
    pusat,
    jejari,
  };
}

/**
 * Menulis satu garis, atau satu cincin negara, ke jalur kanvas dengan proyeksi ortografis yang sama seperti d3.
 * geoPath d3 menghitung trigonometri setiap titik di setiap bingkai, sekitar 20 ms di laptop, sehingga seretan di HP
 * patah-patah. Di sini trigonometrinya dihitung sekali, di vektorDari.
 *
 * Titik di balik bola ditarik ke tepinya, jadi cincin yang sebagian terlihat terpotong di tepi bola. Ini benar
 * selama cincinnya lebih sempit dari 90 derajat, dan yang terlebar Rusia, 71 derajat. Cincin yang seluruhnya di balik
 * bola dilewati, dan garis ditulis hanya di bagian yang terlihat.
 */
export function tulisJalur(
  pena: Pick<CanvasRenderingContext2D, "moveTo" | "lineTo">,
  vektor: Float64Array,
  { cosPutar, sinPutar, cosMiring, sinMiring, pusat, jejari }: Kamera,
  cincin: boolean,
) {
  const kedalaman = (i: number) =>
    (vektor[i] * cosPutar - vektor[i + 1] * sinPutar) * cosMiring - vektor[i + 2] * sinMiring;
  if (cincin) {
    let ada = false;
    for (let i = 0; i < vektor.length && !ada; i += 3) ada = kedalaman(i) > 0;
    if (!ada) return;
  }
  let xLalu = 0;
  let yLalu = 0;
  let terlihatLalu = false;
  let menulis = false;
  for (let i = 0; i < vektor.length; i += 3) {
    let x = vektor[i] * sinPutar + vektor[i + 1] * cosPutar;
    let y = vektor[i + 2] * cosMiring + (vektor[i] * cosPutar - vektor[i + 1] * sinPutar) * sinMiring;
    const terlihat = kedalaman(i) > 0;
    const ukuran = jejari / (terlihat ? 1 : Math.sqrt(x * x + y * y));
    x = pusat + x * ukuran;
    y = pusat - y * ukuran;
    if (i > 0 && (cincin || terlihat || terlihatLalu)) {
      if (!menulis) pena.moveTo(xLalu, yLalu);
      pena.lineTo(x, y);
      menulis = true;
    } else {
      menulis = false;
    }
    xLalu = x;
    yLalu = y;
    terlihatLalu = terlihat;
  }
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
