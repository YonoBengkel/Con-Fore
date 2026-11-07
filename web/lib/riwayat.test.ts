import assert from "node:assert/strict";
import { test } from "node:test";
import type { Titik } from "./data";
import { barisRiwayat, jarangkan, kalimatPeriode, kalimatRiwayat } from "./riwayat.ts";

const bulanan = (n: number, nilai: (i: number) => number): Titik[] =>
  Array.from({ length: n }, (_, i) => [
    `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    nilai(i),
  ]);

test("penjarangan selalu menyertakan titik terakhir", () => {
  const titik = bulanan(100, (i) => i);
  const hasil = jarangkan(titik, 30);
  assert.ok(hasil.length <= 31);
  assert.deepEqual(hasil[hasil.length - 1], titik[99]);
  assert.equal(jarangkan(titik, 200), titik);
});

test("pembanding seri biasa adalah titik asli sebelumnya, walau titiknya dijarangkan", () => {
  const titik = bulanan(100, (i) => i);
  const baris = barisRiwayat(titik, "yoy", 30);
  assert.equal(baris[0][2], null);
  const [p, v, sebelum] = baris[baris.length - 1];
  assert.deepEqual([p, v, sebelum], [titik[99][0], 99, 98]);
});

test("pembanding TPT adalah ronde bulan yang sama tahun lalu", () => {
  const titik: Titik[] = [["2025-02", 4.76], ["2025-08", 4.85], ["2026-02", 4.65], ["2026-05", 4.6], ["2026-08", 4.75]];
  const baris = barisRiwayat(titik, "round_rate");
  assert.equal(baris[2][2], 4.76);
  assert.equal(baris[3][2], null);
  assert.equal(baris[4][2], 4.85);
});

test("kalimat per periode memakai nilai dan perubahan yang sama dengan kartu", () => {
  assert.equal(
    kalimatPeriode(["2026-10", 3.2, 3.3], "%", "yoy", "M"),
    "Oktober 2026: 3,2%, turun 0,1 poin persen dari bulan sebelumnya (3,3%).",
  );
  assert.equal(kalimatPeriode(["2024-01", 2.6, null], "%", "yoy", "M"), "Januari 2024: 2,6%.");
});

test("kesimpulan riwayat memakai jendela lima tahun bila datanya cukup", () => {
  const teks = kalimatRiwayat(bulanan(70, (i) => (i === 69 ? 9 : i % 2)), "%", "yoy", "M")!;
  assert.match(teks, /^Dalam lima tahun terakhir, angka ini bergerak antara 0,0% \(/);
  assert.match(teks, /dan 9,0% \(Oktober 2025\)/);
  assert.match(teks, /Angka terakhir 9,0%, di atas rata-rata itu\.$/);
});

test("kesimpulan riwayat menyebut awal data bila riwayatnya pendek", () => {
  const teks = kalimatRiwayat([["2024-01", 2], ["2024-02", 4], ["2024-03", 3]], "%", "yoy", "M")!;
  assert.match(teks, /^Sejak Januari 2024, /);
  assert.match(teks, /rata-rata 3,0%\. Angka terakhir 3,0%, sama dengan rata-rata itu\.$/);
  assert.equal(kalimatRiwayat([["2024-01", 2]], "%", "yoy", "M"), null);
});

test("kesimpulan riwayat tanpa kata penilaian", () => {
  const teks = kalimatRiwayat(bulanan(70, (i) => i), "%", "yoy", "M")!;
  assert.doesNotMatch(teks, /baik|buruk|gagal|solid|lemah/);
});
