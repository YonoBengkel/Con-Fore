// Tes kalimat perubahan. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import { perubahan, perubahanRingkas } from "./format.ts";

test("TPT per ronde dibanding ronde yang sama tahun lalu, dua desimal", () => {
  assert.equal(
    perubahan(4.65, 4.76, "% angkatan kerja", "round_rate", "M"),
    "turun 0,11 poin persen dari ronde yang sama tahun lalu (4,76%)",
  );
});

test("kalimat ringkas untuk panel berhenti sebelum pembanding", () => {
  assert.equal(perubahanRingkas(4.65, 4.76, "% angkatan kerja", "round_rate", "M"), "turun 0,11 poin persen");
  assert.equal(perubahanRingkas(3.2, 3.2, "%", "yoy", "M"), "sama dengan bulan sebelumnya");
  assert.equal(perubahanRingkas(3.2, null, "%", "yoy", "M"), null);
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

test("angka tampil sama: hampir sama bila nilainya beda, sama bila persis", () => {
  assert.equal(perubahan(5.24, 5.16, "%", "yoy", "Q"), "hampir sama dengan kuartal sebelumnya");
  assert.equal(perubahan(5.75, 5.75, "% per tahun", "rate", "M"), "sama dengan bulan sebelumnya");
});

test("tanpa pembanding, tidak ada kalimat", () => {
  assert.equal(perubahan(4.65, null, "% angkatan kerja", "round_rate", "M"), null);
});
