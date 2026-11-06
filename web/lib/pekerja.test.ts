// Tes kalimat pekerja formal. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Titik } from "./data";
import { kalimatPekerja } from "./pekerja.ts";

const FORMAL: Titik[] = [
  ["2024-08", 42.05],
  ["2025-02", 40.6],
  ["2025-08", 42.2],
  ["2026-02", 40.58],
];
const TPT: Titik[] = [
  ["2024-08", 4.91],
  ["2025-02", 4.76],
  ["2025-08", 4.85],
  ["2025-11", 4.74],
  ["2026-02", 4.68],
];

test("hanya membandingkan ronde bulan yang sama", () => {
  const k = kalimatPekerja(FORMAL, TPT)!;
  assert.equal(k.porsi, "Porsi pekerja formal Februari 2026: 40,58%, hampir tidak berubah dari Februari 2025 (40,60%).");
  assert.equal(
    k.hubungan,
    "Pada ronde yang sama, pengangguran turun 0,08 poin persen, tetapi komposisi pekerja formal dan informal hampir tidak berubah.",
  );
});

test("porsi naik dan pengangguran turun disambung dengan dan", () => {
  const k = kalimatPekerja(FORMAL.slice(0, 3), TPT)!;
  assert.equal(k.porsi, "Porsi pekerja formal Agustus 2025: 42,20%, naik 0,15 poin persen dari Agustus 2024 (42,05%).");
  assert.equal(k.hubungan, "Pada ronde yang sama, pengangguran turun 0,06 poin persen, dan komposisi pekerja bergeser ke sektor formal.");
});

test("porsi turun saat pengangguran turun disambung dengan tetapi", () => {
  const k = kalimatPekerja([["2025-02", 40.83], ["2026-02", 40.58]], TPT.concat([["2025-02", 4.76]]))!;
  assert.equal(k.porsi, "Porsi pekerja formal Februari 2026: 40,58%, turun 0,25 poin persen dari Februari 2025 (40,83%).");
  assert.match(k.hubungan!, /tetapi komposisi pekerja bergeser ke sektor informal\.$/);
});

test("tanpa ronde pembanding atau tanpa TPT, kalimatnya dipendekkan", () => {
  assert.deepEqual(kalimatPekerja([["2017-02", 40]], TPT), { porsi: "Porsi pekerja formal Februari 2017: 40,00%.", hubungan: null });
  assert.equal(kalimatPekerja(FORMAL, [])!.hubungan, null);
  assert.equal(kalimatPekerja([], TPT), null);
});
