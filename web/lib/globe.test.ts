// Globe halaman depan: data Natural Earth lewat world-atlas, mode per perangkat, putaran, angkat, dan uji kena
// Indonesia. Titik kota dan titik laut dicek ke data 1:110m pada 2026-11-22.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { geoContains, type Titik } from "d3-geo";
import type { Topologi } from "topojson-client";
import {
  ID_INDONESIA,
  kenaIndonesia,
  langkahAngkat,
  pilihMode,
  putar,
  selisihSudut,
  siapkanData,
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
