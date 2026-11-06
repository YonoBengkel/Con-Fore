// Tes keterangan jadwal rilis. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { MetaSeri } from "./data";
import { keteranganJadwal } from "./konten.ts";

const seri = (source_id: string, country = "IDN") => ({ source_id, country }) as MetaSeri;
const PERKIRAAN = "perkiraan dari pola rilis BPS, jadwal resminya belum terbit";

test("jadwal sumbernya sendiri, resmi atau perkiraan, tanpa catatan menyusul", () => {
  assert.equal(keteranganJadwal(seri("bps"), "bps"), "jadwal rilis BPS");
  assert.equal(keteranganJadwal(seri("bps"), "bps-perkiraan"), PERKIRAAN);
});

test("salinan dan data lain tetap diberi catatan menyusul", () => {
  assert.equal(
    keteranganJadwal(seri("imf"), "bps-perkiraan"),
    `${PERKIRAAN}; angka di sini menyusul lewat salinan IMF`,
  );
  assert.equal(
    keteranganJadwal(seri("bis"), "bi-rdg"),
    "jadwal Rapat Dewan Gubernur BI; angka di sini menyusul lewat data BIS",
  );
});
