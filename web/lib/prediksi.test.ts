import assert from "node:assert/strict";
import { test } from "node:test";
import type { BarisRamalan, SkorBacktest, Target, Titik } from "./data";
import {
  TARGET_PREDIKSI,
  artinyaPerkiraan,
  barisJangkaPanjang,
  jalurUtama,
  kalimatCara,
  kalimatEfekBasis,
  kalimatJangkaPanjang,
  maeModel,
  modelTerurut,
  nilaiTahunPerkiraan,
  tahunPerkiraan,
  teksRentang,
} from "./prediksi.ts";

function ramalan(series_id: string, ref_period: string, point: number, ubah: Partial<BarisRamalan> = {}): BarisRamalan {
  return {
    series_id,
    ref_period,
    model: "sama_terakhir",
    is_main: true,
    horizon: 1,
    point,
    lo80: null,
    hi80: null,
    origin_date: "2026-11-07",
    ...ubah,
  };
}

function skor(series_id: string, model: string, horizon: number, mae: number, window_name: SkorBacktest["window_name"] = "normal", n = 100): SkorBacktest {
  return { series_id, model, horizon, window_name, is_main: false, mae, rmse: mae, n };
}

const [PDB, INFLASI, TPT] = TARGET_PREDIKSI;

test("jalur utama hanya angka utama satu seri, urut menurut periode", () => {
  const baris = [
    ramalan("a", "2027-01", 3),
    ramalan("a", "2026-12", 2),
    ramalan("a", "2026-12", 9, { model: "ar1", is_main: false }),
    ramalan("b", "2026-12", 7),
  ];
  assert.deepEqual(jalurUtama(baris, "a").map((b) => b.point), [2, 3]);
});

test("rentang kosong bila backtest belum cukup", () => {
  assert.equal(teksRentang(null, 3, 1), null);
  assert.equal(teksRentang(2.7, 3.8, 1), "2,7% sampai 3,8%");
});

test("tahun perkiraan mengikuti kuartal IV pertama yang belum terbit", () => {
  assert.equal(tahunPerkiraan([ramalan("x", "2026-Q4", 5), ramalan("x", "2027-Q1", 5)]), 2026);
  assert.equal(tahunPerkiraan([ramalan("x", "2027-Q1", 5), ramalan("x", "2027-Q4", 5)]), 2027);
  assert.equal(tahunPerkiraan([]), null);
});

test("angka tahunan memakai angka resmi dulu, lalu perkiraan", () => {
  const resmi = {
    pdb: [["2026-Q1", 5.6], ["2026-Q2", 5.3], ["2026-Q3", 5.5]] as Titik[],
    inflasi: [["2026-10", 3.2]] as Titik[],
    tpt: [["2026-08", 4.75]] as Titik[],
  };
  const jalur = {
    pdb: [ramalan("p", "2026-Q4", 5.4)],
    inflasi: [ramalan("i", "2026-12", 3.2)],
    tpt: [ramalan("u", "2026-11", 4.7)],
  };
  const hasil = nilaiTahunPerkiraan(2026, resmi, jalur)!;
  assert.ok(Math.abs(hasil.pertumbuhan - 5.45) < 1e-9);
  assert.equal(hasil.inflasi, 3.2);
  assert.equal(hasil.pengangguran, 4.75);
});

test("TPT tanpa ronde Agustus memakai angka utama terakhir, dan kuartal bolong membuat tahun kosong", () => {
  const resmi = { pdb: [] as Titik[], inflasi: [] as Titik[], tpt: [["2026-08", 4.75]] as Titik[] };
  const jalur = {
    pdb: ["Q1", "Q2", "Q3", "Q4"].map((q) => ramalan("p", `2027-${q}`, 5)),
    inflasi: [ramalan("i", "2027-12", 3)],
    tpt: [ramalan("u", "2026-11", 4.7), ramalan("u", "2027-02", 4.6)],
  };
  assert.equal(nilaiTahunPerkiraan(2027, resmi, jalur)!.pengangguran, 4.6);
  assert.equal(nilaiTahunPerkiraan(2028, resmi, jalur), null);
});

test("skor dicari per seri, model, horizon, dan jendela", () => {
  const data = [skor("s", "a", 1, 0.2), skor("s", "a", 1, 0.5, "uji")];
  assert.equal(maeModel(data, "s", "a", 1), 0.2);
  assert.equal(maeModel(data, "s", "a", 1, "uji"), 0.5);
  assert.equal(maeModel(data, "s", "a", 2), null);
});

test("urutan model: angka utama dulu, lalu galat terkecil", () => {
  const data = [skor("s", "b", 1, 0.3), skor("s", "c", 1, 0.2), skor("s", "a", 1, 0.9)];
  assert.deepEqual(modelTerurut(data, "s", 1, "a"), ["a", "c", "b"]);
});

test("kalimat cara menyebut galat angka utama dan pembandingnya", () => {
  const jalur = [ramalan(PDB.seri, "2026-Q4", 5.47)];
  const data = [skor(PDB.seri, "sama_terakhir", 1, 0.157), skor(PDB.seri, "dfm", 1, 0.243)];
  const [cara, uji] = kalimatCara(PDB, jalur, data);
  assert.match(cara, /sama dengan angka resmi terakhir/);
  assert.match(uji, /1 kuartal ke depan, cara ini rata-rata meleset 0,16 poin persen/);
  assert.match(uji, /Model faktor \(DFM\) 0,24/);
});

test("kalimat cara memilih horizon dengan cukup uji dan menyebut jumlah uji yang sedikit", () => {
  const jalur = [ramalan(TPT.seri, "2026-11", 4.75, { horizon: 3 })];
  const sedikit = [
    skor(TPT.seri, "sama_terakhir", 3, 0.07, "normal", 4),
    skor(TPT.seri, "sama_terakhir", 6, 0.24, "normal", 19),
    skor(TPT.seri, "regresi", 6, 0.18, "normal", 19),
  ];
  const [, uji, alasan] = kalimatCara(TPT, jalur, sedikit);
  assert.match(uji, /6 bulan ke depan, cara ini rata-rata meleset 0,24 poin persen \(baru 19 kali uji\)/);
  assert.match(alasan, /Cara yang lebih kecil di sini belum dipakai/);
  const cukup = [...sedikit, skor(TPT.seri, "sama_terakhir", 12, 0.3, "normal", 25)];
  assert.match(kalimatCara(TPT, jalur, cukup)[1], /12 bulan ke depan/);
});

test("kalimat cara memberi tahu bila cara berbeda antarperiode", () => {
  const jalur = [ramalan(PDB.seri, "2026-Q4", 5.4), ramalan(PDB.seri, "2027-Q1", 5.3, { model: "ar1" })];
  assert.ok(kalimatCara(PDB, jalur, []).at(-1)?.includes("berbeda antarperiode"));
});

test("kalimat cara tetap jujur saat belum ada skor", () => {
  const jalur = [ramalan(PDB.seri, "2026-Q4", 5.47)];
  assert.equal(kalimatCara(PDB, jalur, []).length, 1);
  assert.deepEqual(kalimatCara(PDB, [], []), []);
});

test("efek basis menunjuk bulan dengan lompatan terbesar dan pola bulan itu", () => {
  const jalur = [
    ramalan(INFLASI.seri, "2026-11", 3.3),
    ramalan(INFLASI.seri, "2026-12", 3.2),
    ramalan(INFLASI.seri, "2027-01", 3.5),
  ];
  const teks = kalimatEfekBasis(jalur, 3.25, [["2026-01", 0.1]])!;
  assert.match(teks, /Januari 2027/);
  assert.match(teks, /naik sekitar 0,3 poin persen/);
  assert.match(teks, /harga Januari 2026 naik 0,10%, sedangkan pola lima tahun terakhir untuk bulan itu naik 0,40%/);
  const turun = kalimatEfekBasis(jalur, 3.25, [["2026-01", -0.14]])!;
  assert.match(turun, /harga Januari 2026 turun 0,14%, sedangkan pola lima tahun terakhir untuk bulan itu naik 0,16%/);
});

test("efek basis diam bila lompatannya kecil atau bulan pembandingnya tidak ada", () => {
  assert.equal(kalimatEfekBasis([ramalan(INFLASI.seri, "2026-11", 3.26)], 3.25, [["2025-11", 0.1]]), null);
  assert.equal(kalimatEfekBasis([ramalan(INFLASI.seri, "2026-11", 3.9)], 3.25, []), null);
});

test("artinya buatmu selalu bersyarat dan tanpa saran", () => {
  assert.equal(
    artinyaPerkiraan("inflasi", 3.32),
    "Bila perkiraan ini tepat, belanja yang setahun sebelumnya Rp100.000 menjadi sekitar Rp103.300.",
  );
  for (const kunci of ["pertumbuhan", "inflasi", "pengangguran"] as const) {
    const teks = artinyaPerkiraan(kunci, 3);
    assert.match(teks, /^Bila perkiraan ini tepat/);
    assert.doesNotMatch(teks, /sebaiknya|harus|segera/);
  }
});

test("panel jangka panjang hanya tahun sesudah angka resmi, dengan target RPJMN bila ada", () => {
  const target = [
    { series_id: "idn_gdp_growth_a", year: 2029, target_kind: "rpjmn", value: 8 },
    { series_id: "idn_gdp_growth_a", year: 2028, target_kind: "apbn", value: 7 },
  ] as Target[];
  const resmi: Titik[] = [["2000", 4.9], ["2008", 7.4], ["2025", 5.1]];
  const baris = barisJangkaPanjang([["2025", 5.1], ["2028", 5.2], ["2029", 5.2], ["2030", 5.2]], resmi, target);
  assert.deepEqual(baris.map((b) => b.tahun), [2028, 2029, 2030]);
  assert.equal(baris[0].rpjmn, null);
  assert.equal(baris[1].rpjmn, 8);
  assert.equal(
    kalimatJangkaPanjang(baris, resmi),
    "Untuk 2029, proyeksi IMF 5,2% dan target RPJMN 8,0%, selisih 2,8 poin persen. Sejak 2000, pertumbuhan tahunan tertinggi 7,4% pada 2008.",
  );
  assert.equal(kalimatJangkaPanjang([{ tahun: 2030, imf: 5, rpjmn: null }], resmi), null);
});
