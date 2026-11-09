import assert from "node:assert/strict";
import { test } from "node:test";
import type { Titik } from "./data";
import { barisRiwayat, jarangkan, judulTemuan, kalimatPeriode, kalimatRiwayat } from "./riwayat.ts";

test("judul temuan membandingkan periode yang sama setahun sebelumnya dengan kata netral", () => {
  const hasil = [
    judulTemuan([["2025-09", 2.0], ["2025-10", 1.9], ["2026-09", 3.3], ["2026-10", 3.2]], "%", "yoy"),
    judulTemuan([["2025-Q3", 5.0], ["2026-Q2", 5.3], ["2026-Q3", 4.9]], "%", "yoy"),
    judulTemuan([["2025-08", 4.85], ["2026-02", 4.68], ["2026-08", 4.75]], "% angkatan kerja", "round_rate"),
    judulTemuan([["2025-09", 5.75], ["2026-09", 5.749]], "% per tahun", "rate"),
    judulTemuan([["2025-11-05", 16300], ["2025-11-07", 16350], ["2026-11-06", 18100]], "rupiah per dolar AS", "level"),
    judulTemuan([["2025-10", 99.2], ["2026-10", 98.6]], "indeks, rata-rata jangka panjang = 100", "level"),
  ];
  assert.deepEqual(hasil, [
    "Dibanding Oktober 2025, angka ini naik dari 1,9% ke 3,2%.",
    "Dibanding kuartal III 2025, angka ini turun dari 5,0% ke 4,9%.",
    "Dibanding Agustus 2025, angka ini turun dari 4,85% ke 4,75%.",
    "Dibanding September 2025, angka ini tetap 5,75%.",
    "Dibanding 5 November 2025, angka ini naik dari 16.300 ke 18.100 rupiah per dolar AS.",
    "Dibanding Oktober 2025, angka ini turun dari 99,2 ke 98,6.",
  ]);
  for (const k of hasil) assert.doesNotMatch(k ?? "", /membaik|memburuk|mengkhawatirkan|baik|buruk|solid|anjlok|melonjak/);
});

test("judul temuan memakai titik pertama bila riwayatnya belum setahun", () => {
  assert.equal(judulTemuan([["2026-08", 3.0], ["2026-10", 3.2]], "%", "yoy"), "Sejak Agustus 2026, angka ini naik dari 3,0% ke 3,2%.");
  assert.equal(judulTemuan([["2026-10", 3.2]], "%", "yoy"), null);
});

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
