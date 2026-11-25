// Tes kalimat perubahan. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import { angkaTampil, perubahan, selisihTampil } from "./format.ts";

test("TPT per ronde dibanding ronde yang sama tahun lalu, dua desimal", () => {
  assert.equal(
    perubahan(4.65, 4.76, "% angkatan kerja", "round_rate", "M"),
    "turun 0,11 poin persen dari ronde yang sama tahun lalu (4,76%)",
  );
});

test("kalimat mengikuti angka yang tampil, bukan selisih mentah", () => {
  assert.equal(
    perubahan(3.23, 3.28, "%", "yoy", "M"),
    "turun 0,1 poin persen dari bulan sebelumnya (3,3%)",
  );
  assert.equal(
    perubahan(5.47, 5.29, "%", "yoy", "Q"),
    "naik 0,2 poin persen dari kuartal sebelumnya (5,3%)",
  );
});

test("angka yang dibulatkan berbeda oleh toFixed mengikuti yang tampil: 2,55 tampil 2,6", () => {
  assert.equal(angkaTampil(2.55, 1), 2.6);
  assert.equal(angkaTampil(-0.04, 1), 0); // bukan nol negatif
  assert.equal(perubahan(2.55, 2.6, "%", "yoy", "M"), "hampir sama dengan bulan sebelumnya");
  assert.equal(perubahan(2.55, 2.5, "%", "yoy", "M"), "naik 0,1 poin persen dari bulan sebelumnya (2,5%)");
});

test("selisih angka tampil tidak berekor", () => {
  assert.equal(selisihTampil(40.3, 40.2, 2), 0.1); // 40.3 - 40.2 = 0.09999999999999432
  assert.equal(selisihTampil(3.23, 3.28, 1), -0.1);
  assert.equal(selisihTampil(2.55, 2.6, 1), 0);
});

test("angka tampil sama: hampir sama bila nilainya beda, sama bila persis", () => {
  assert.equal(perubahan(5.24, 5.16, "%", "yoy", "Q"), "hampir sama dengan kuartal sebelumnya");
  assert.equal(perubahan(5.75, 5.75, "% per tahun", "rate", "M"), "sama dengan bulan sebelumnya");
});

test("tanpa pembanding, tidak ada kalimat", () => {
  assert.equal(perubahan(4.65, null, "% angkatan kerja", "round_rate", "M"), null);
});
