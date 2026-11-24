// Globe halaman depan: data Natural Earth lewat world-atlas, jalur yang digambar, mode per perangkat, putaran,
// seretan, angkat, dan uji kena Indonesia. Titik kota dan titik laut dicek ke data 1:110m pada 2026-11-22.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { geoContains, geoOrthographic, geoPath, type Titik } from "d3-geo";
import type { Topologi } from "topojson-client";
import {
  type Hadap,
  ID_INDONESIA,
  MIRING_MAKS,
  hadapKe,
  kenaIndonesia,
  lajuLepas,
  langkahAngkat,
  langkahLempar,
  pasangKamera,
  pilihMode,
  putar,
  selisihSudut,
  seret,
  siapkanData,
  tulisJalur,
  vektorDari,
} from "./globe.ts";

const dunia: Topologi = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const data = siapkanData(dunia);
/** Kebalikan proyeksi untuk tes: titik layar dibaca langsung sebagai [bujur, lintang]. */
const langsung = (titik: Titik): Titik => titik;
const dekat = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("Indonesia dipisahkan dari 176 negara lain, dengan titik tengah di wilayahnya", () => {
  assert.equal(data.indonesia.id, ID_INDONESIA);
  assert.equal(data.indonesia.properties.name, "Indonesia");
  assert.equal(data.lainnya.features.length, 176);
  const [bujur, lintang] = data.pusat;
  assert.ok(bujur > 110 && bujur < 125, `bujur ${bujur}`);
  assert.ok(lintang > -6 && lintang < 2, `lintang ${lintang}`);
});

/** Menjalankan tulisJalur dengan pena tiruan: titik yang ditulis, dan luas bidangnya dalam piksel persegi. */
function tulis(daftar: Float64Array[], hadap: Hadap, jejari: number, cincin: boolean) {
  const titik: Titik[] = [];
  let luas = 0;
  let lalu: Titik = [0, 0];
  const pena = {
    moveTo(x: number, y: number) {
      lalu = [x, y];
      titik.push(lalu);
    },
    lineTo(x: number, y: number) {
      luas += (lalu[0] * y - x * lalu[1]) / 2;
      lalu = [x, y];
      titik.push(lalu);
    },
  };
  for (const vektor of daftar) tulisJalur(pena, vektor, pasangKamera(hadap, 0, jejari), cincin);
  return { titik, luas: Math.abs(luas) };
}

/** Arah hadap yang tersebar di seluruh bola, sampai batas kemiringan. */
const arahUji: Hadap[] = Array.from({ length: 36 }, (_, i) => [((i * 137.5) % 360) - 180, ((i * 41) % 141) - 70]);

test("jalur yang digambar sama dengan proyeksi d3", () => {
  for (const hadap of arahUji) {
    const asal = geoOrthographic().translate([0, 0]).scale(500).rotate(hadap).invert([60, -90])!;
    const [vektor] = vektorDari({ type: "Polygon", coordinates: [[asal, asal]] });
    const [[x, y]] = tulis([vektor], hadap, 500, false).titik;
    assert.ok(Math.hypot(x - 60, y + 90) < 1e-6, `hadap ${hadap}: (${x}, ${y})`);
  }
});

test("luas daratan di layar sama dengan geoPath d3, juga saat terpotong tepi bola", () => {
  const cakram = Math.PI * 500 ** 2;
  const lainnya = data.lainnya.features.flatMap((negara) => vektorDari(negara.geometry));
  const indonesia = vektorDari(data.indonesia.geometry);
  for (const hadap of arahUji) {
    const jalur = geoPath(geoOrthographic().translate([0, 0]).scale(500).rotate(hadap));
    const selisih = Math.abs(tulis(lainnya, hadap, 500, true).luas - jalur.area(data.lainnya));
    assert.ok(selisih < cakram * 2e-4, `hadap ${hadap}: ${selisih}`);
    const selisihIndonesia = Math.abs(tulis(indonesia, hadap, 500, true).luas - jalur.area(data.indonesia));
    assert.ok(selisihIndonesia < cakram * 2e-5, `hadap ${hadap}: ${selisihIndonesia}`);
  }
});

test("yang di balik bola tidak digambar, dan yang terpotong berhenti di tepi bola", () => {
  const diBalik: Titik[] = [[170, 5], [175, 0], [170, -5], [170, 5]];
  const belakang = vektorDari({ type: "Polygon", coordinates: [diBalik] });
  assert.equal(tulis(belakang, [0, 0], 100, true).titik.length, 0);
  assert.equal(tulis(belakang, [0, 0], 100, false).titik.length, 0);
  const lintas = vektorDari({ type: "MultiLineString", coordinates: [[[0, 0], [80, 0], [170, 0]]] });
  const { titik } = tulis(lintas, [0, 0], 100, false);
  const [x, y] = titik[titik.length - 1];
  assert.ok(Math.hypot(x - 100, y) < 1e-9, `(${x}, ${y})`);
  assert.ok(titik.every((t) => Math.hypot(...t) < 100 + 1e-9));
});

test("ruas panjang dibagi, dan setiap cincin lebih sempit dari 90 derajat", () => {
  const [garis] = vektorDari({ type: "MultiLineString", coordinates: [[[0, 0], [80, 0]]] });
  assert.equal(garis.length / 3, 33);
  for (const negara of [data.indonesia, ...data.lainnya.features])
    for (const v of vektorDari(negara.geometry)) {
      let cosTerkecil = 1;
      for (let i = 0; i < v.length; i += 3)
        for (let j = 0; j < i; j += 3)
          cosTerkecil = Math.min(cosTerkecil, v[i] * v[j] + v[i + 1] * v[j + 1] + v[i + 2] * v[j + 2]);
      assert.ok(cosTerkecil > 0, negara.properties.name);
    }
});

test("kota di Indonesia kena, kota di negara tetangga tidak", () => {
  const kena = (titik: Titik) => kenaIndonesia(data, langsung, titik, 0);
  const indonesia: Record<string, Titik> = {
    "Palangka Raya": [113.92, -2.21],
    Bandung: [107.61, -6.91],
    Jayapura: [140.7, -2.6],
  };
  const tetangga: Record<string, Titik> = {
    "Kuala Lumpur": [101.69, 3.14],
    Kuching: [110.35, 1.55],
    Dili: [125.57, -8.56],
    Darwin: [130.84, -12.46],
  };
  for (const [kota, titik] of Object.entries(indonesia)) assert.ok(kena(titik), kota);
  for (const [kota, titik] of Object.entries(tetangga)) assert.ok(!kena(titik), kota);
});

test("toleransi menangkap sentuhan di laut dekat pantai, tetapi tidak di luar bola", () => {
  const lautSelatanJawa: Titik = [110.4, -8.4];
  assert.ok(!kenaIndonesia(data, langsung, lautSelatanJawa, 0));
  assert.ok(kenaIndonesia(data, langsung, lautSelatanJawa, 0.5));
  assert.ok(!kenaIndonesia(data, () => null, lautSelatanJawa, 0.5));
});

test("toleransi tidak mengambil daratan negara tetangga di dekat perbatasan", () => {
  const sarawak: Titik = [112, 1.8];
  const kalimantanDiSelatannya: Titik = [112, 0.8];
  assert.ok(geoContains(data.lainnya, sarawak), "titik uji harus di Malaysia");
  assert.ok(kenaIndonesia(data, langsung, kalimantanDiSelatannya, 0), "titik selatannya harus di Indonesia");
  assert.ok(!kenaIndonesia(data, langsung, sarawak, 1));
});

test("angkatan tidak membuat titik di dekat pantai keluar dari Indonesia", () => {
  const lautUtaraJawa: Titik = [110.4, -6.5];
  // Sebelum terangkat titik ini kena lewat toleransi, tetapi posisi yang digeser sejauh angkatan meleset.
  assert.ok(kenaIndonesia(data, langsung, lautUtaraJawa, 0.5));
  assert.ok(!kenaIndonesia(data, langsung, [110.4, -5.5], 0.5));
  assert.ok(kenaIndonesia(data, langsung, lautUtaraJawa, 0.5, 1));
});

test("komputer berputar, kurangi animasi diam, dan HP diam dengan Indonesia terangkat", () => {
  assert.deepEqual(pilihMode(true, false), { berputar: true, angkatAwal: false });
  assert.deepEqual(pilihMode(true, true), { berputar: false, angkatAwal: false });
  assert.deepEqual(pilihMode(false, false), { berputar: false, angkatAwal: true });
  assert.deepEqual(pilihMode(false, true), { berputar: false, angkatAwal: true });
});

test("putaran 4 derajat per detik, tanpa lompatan sesudah jeda panjang", () => {
  assert.ok(dekat(putar(10, 50), 10.2));
  assert.ok(dekat(putar(10, 5000), 10.4));
  assert.ok(dekat(putar(359.9, 50), 0.1));
  assert.ok(dekat(putar(10, -20), 10));
  assert.ok(dekat(putar(10, 50, -1), 9.8));
});

test("permukaan di tengah bola mengikuti arah dan jarak seretan", () => {
  const jejari = 200;
  for (const miring of [2, -35, 60]) {
    const awal: Hadap = [-118, miring];
    const proyeksi = geoOrthographic().translate([0, 0]).scale(jejari).rotate(awal);
    const titikTengah = proyeksi.invert([0, 0])!;
    for (const [dx, dy] of [
      [8, 0],
      [-8, 0],
      [0, 6],
      [5, -4],
    ]) {
      const [x, y] = proyeksi.rotate(seret(awal, dx, dy, jejari))(titikTengah)!;
      assert.ok(Math.hypot(x - dx, y - dy) < 0.5, `miring ${miring}, diseret (${dx}, ${dy}), bergerak (${x}, ${y})`);
    }
    proyeksi.rotate(awal);
  }
});

test("globe menghadap titik yang diketuk, sejauh batas kemiringan", () => {
  const sydney: Titik = [151.2, -33.9];
  const [x, y] = geoOrthographic().translate([0, 0]).rotate(hadapKe(sydney))(sydney)!;
  assert.ok(Math.hypot(x, y) < 1e-9, `(${x}, ${y})`);
  assert.equal(hadapKe([0, 88])[1], -MIRING_MAKS);
  assert.equal(hadapKe([0, -88])[1], MIRING_MAKS);
});

test("seretan tegak berhenti di batas kemiringan, jadi utara selalu di atas", () => {
  assert.equal(seret([0, 0], 0, 5000, 200)[1], -MIRING_MAKS);
  assert.equal(seret([0, 0], 0, -5000, 200)[1], MIRING_MAKS);
});

test("laju lepas dibaca dari 100 ms terakhir, dan nol bila berhenti dulu", () => {
  const jejak = [0, 20, 40, 60, 80].map((waktu) => ({ waktu, x: waktu * 2, y: -waktu }));
  assert.deepEqual(lajuLepas(jejak, 80), [2000, -1000]);
  assert.deepEqual(lajuLepas(jejak, 500), [0, 0]);
  assert.deepEqual(lajuLepas(jejak.slice(0, 1), 10), [0, 0]);
  assert.deepEqual(lajuLepas([], 10), [0, 0]);
});

test("lemparan melambat, dan jaraknya tidak bergantung pada panjang bingkai", () => {
  const lempar = (bingkai: number) => {
    let laju: [number, number] = [600, -300];
    let jarak = 0;
    for (let t = 0; t < 960; t += bingkai) {
      const langkah = langkahLempar(laju, bingkai);
      jarak += langkah.dx;
      laju = langkah.laju;
    }
    return { jarak, laju };
  };
  assert.ok(Math.abs(lempar(16).jarak - lempar(32).jarak) < 1e-6);
  assert.ok(lempar(16).jarak > 0 && lempar(16).jarak < 600 * 0.325);
  assert.ok(Math.hypot(...lempar(16).laju) < 60);
});

test("angkat Indonesia bergerak lurus menuju arahnya, dan langsung bila durasinya nol", () => {
  assert.equal(langkahAngkat(0, true, 75, 150), 0.5);
  assert.equal(langkahAngkat(0.5, true, 150, 150), 1);
  assert.equal(langkahAngkat(0.5, false, 150, 150), 0);
  assert.equal(langkahAngkat(0.3, true, 16, 0), 1);
  assert.equal(langkahAngkat(0.3, false, 16, 0), 0);
});

test("selisih sudut memilih arah terpendek", () => {
  assert.equal(selisihSudut(170, -170), 20);
  assert.equal(selisihSudut(-170, 170), -20);
  assert.equal(selisihSudut(-118, -118), 0);
  assert.equal(selisihSudut(-118 + 720, -118), 0);
});
