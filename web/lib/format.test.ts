// Tes kalimat perubahan. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import { perubahan } from "./format.ts";

test("TPT per ronde dibanding ronde yang sama tahun lalu, dua desimal", () => {
  assert.equal(
    perubahan(4.65, 4.76, "% angkatan kerja", "round_rate", "M"),
    "turun 0,11 poin persen dari ronde yang sama tahun lalu (4,76%)",
  );
});

test("tanpa pembanding, tidak ada kalimat", () => {
  assert.equal(perubahan(4.65, null, "% angkatan kerja", "round_rate", "M"), null);
});
