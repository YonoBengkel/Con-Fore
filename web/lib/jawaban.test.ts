// Jawaban empat pertanyaan: angka dari konsep C yang lulus uji (per 20 November 2026), supaya kalimatnya
// tetap sama dengan yang dibaca peserta uji, kecuali aturan "sedikit" yang kini dihitung.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BarisRamalan, MetaSeri, NilaiTerakhir, Target, Titik } from "./data";
import {
  SEDIKIT,
  arahBanding,
  buatJawaban,
  kalimatTarget,
  kalimatWaktu,
  rataJangkaPanjang,
  ringkasanCerita,
  type Bagian,
  type Jawaban,
} from "./jawaban.ts";
import { TAHUN_AKHIR, TAHUN_AWAL, TOPIK, topikDari, topikSeri } from "./konten.ts";

const [HARGA, KERJA, EKONOMI] = TOPIK;

function meta(series_id: string, concept: string, frequency: MetaSeri["frequency"], next: string | null): MetaSeri {
  return {
    series_id,
    source_id: "bps",
    country: "IDN",
    name_id: series_id,
    unit: "%",
    concept,
    frequency,
    citation: "Badan Pusat Statistik (BPS), WebAPI.",
    last_period: null,
    last_release_date: null,
    next_release_date: next,
  };
}

function nilai(series_id: string, period: string, value: number, previous_value: number | null): NilaiTerakhir {
  return { series_id, period, value, previous_value, release_date: null, seen_date: "2026-11-02", source_id: "bps", is_stale: false };
}

function target(series_id: string, target_kind: Target["target_kind"], v: Partial<Target>): Target {
  return {
    series_id,
    year: 2026,
    target_kind,
    value: null,
    lower: null,
    upper: null,
    document: "dokumen",
    url: "https://example.org",
    last_verified: "2026-11-06",
    verification: "dokumen",
    ...v,
  };
}

/** Satu nilai untuk setiap tahun TAHUN_AWAL sampai TAHUN_AKHIR, jadi rata-ratanya nilai itu sendiri. */
const tahunan = (v: number): Titik[] =>
  Array.from({ length: TAHUN_AKHIR - TAHUN_AWAL + 1 }, (_, i): Titik => [String(TAHUN_AWAL + i), v]);

const TARGET: Target[] = [
  target("idn_cpi_eop_a", "pmk", { value: 2.5, lower: 1.5, upper: 3.5 }),
  target("idn_unemp_a", "apbn", { lower: 4.44, upper: 4.96 }),
  target("idn_gdp_growth_a", "apbn", { value: 5.4 }),
];

const harga = buatJawaban({
  topik: HARGA,
  meta: meta("bps_cpi_yoy_m", "yoy", "M", "2026-12-01"),
  nilai: nilai("bps_cpi_yoy_m", "2026-10", 3.23, 3.31),
  titik: [["2025-10", 2.86], ["2026-09", 3.31], ["2026-10", 3.23]],
  tahunan: tahunan(5.75),
  target: TARGET,
  kalender: "bps",
});

const kerja = buatJawaban({
  topik: KERJA,
  meta: meta("bps_unemp_round", "round_rate", "M", "2027-02-05"),
  nilai: nilai("bps_unemp_round", "2026-08", 4.75, 4.85),
  titik: [["2025-08", 4.85], ["2026-02", 4.8], ["2026-08", 4.75]],
  tahunan: tahunan(7.08),
  target: TARGET,
  kalender: "bps-perkiraan",
});

const ekonomi = buatJawaban({
  topik: EKONOMI,
  meta: meta("bps_gdp_growth_q", "yoy", "Q", "2027-02-05"),
  nilai: nilai("bps_gdp_growth_q", "2026-Q3", 5.47, 5.12),
  titik: [["2025-Q3", 5.04], ["2026-Q2", 5.12], ["2026-Q3", 5.47]],
  tahunan: tahunan(4.96),
  target: TARGET,
});

const teks = (kalimat: Bagian[]) => kalimat.map((b) => (typeof b === "string" ? b : b.angka)).join("");

test("jawaban Harga: kalimat, angka, label, keranjang belanja, tiga patokan, dan waktu rilis", () => {
  assert.equal(harga.kalimat, "Dibanding setahun lalu, harga barang dan jasa naik rata-rata 3,2%.");
  assert.equal(harga.angka, "3,2%");
  assert.equal(harga.label, "Angka resmi BPS untuk Oktober 2026");
  assert.equal(
    harga.contoh,
    "Bayangkan satu keranjang belanja yang isinya sama setiap bulan. Keranjang yang setahun lalu Rp100.000 kini sekitar Rp103.200. Harga masih naik, tetapi lebih lambat dibanding bulan lalu.",
  );
  assert.deepEqual(harga.banding, [
    "Lebih tinggi dari setahun lalu, Oktober 2025 (2,9%).",
    "Lebih rendah dari rata-rata tahun 2000 sampai 2025 (5,8%).",
    "Di dalam sasaran pemerintah untuk akhir 2026, yaitu 1,5% sampai 3,5%.",
  ]);
  assert.equal(harga.waktu, "Rilis berikutnya 1 Desember 2026.");
});

test("jawaban Kerja: survei bulan yang sama, 100 orang, dan rilis yang masih perkiraan", () => {
  assert.equal(kerja.kalimat, "Dari semua orang yang bekerja atau sedang mencari kerja, 4,75% belum mendapat pekerjaan.");
  assert.equal(kerja.label, "Angka resmi BPS untuk survei Agustus 2026");
  assert.equal(
    kerja.contoh,
    "Bayangkan 100 orang yang bekerja atau sedang mencari kerja. Sekitar 5 di antaranya belum mendapat pekerjaan.",
  );
  assert.deepEqual(kerja.banding, [
    "Sedikit lebih rendah dari setahun lalu, Agustus 2025 (4,85%).",
    "Lebih rendah dari rata-rata tahun 2000 sampai 2025 (7,1%).",
    "Di dalam target pemerintah untuk 2026, yaitu 4,44% sampai 4,96%.",
  ]);
  assert.equal(kerja.waktu, "Rilis berikutnya diperkirakan 5 Februari 2027.");
});

test("jawaban Ekonomi: kue, kuartal dengan bulannya, dan target satu nilai", () => {
  assert.equal(ekonomi.kalimat, "Dibanding setahun lalu, ekonomi Indonesia tumbuh 5,5%.");
  assert.equal(ekonomi.label, "Angka resmi BPS untuk kuartal III 2026 (Juli sampai September)");
  assert.equal(
    ekonomi.contoh,
    "Bayangkan semua barang dan jasa yang dihasilkan di Indonesia sebagai satu kue. Kuenya kini 5,5% lebih besar dibanding setahun sebelumnya.",
  );
  assert.deepEqual(ekonomi.banding, [
    "Lebih cepat dari setahun lalu, kuartal III 2025 (5,0%).",
    "Lebih cepat dari rata-rata tahun 2000 sampai 2025 (5,0%).",
    "Sedikit di atas target pemerintah untuk seluruh 2026, yaitu 5,4%.",
  ]);
  assert.equal(ekonomi.waktu, "Rilis berikutnya diperkirakan 5 Februari 2027.");
});

test("ringkasan bercerita: satu kalimat per pertanyaan, angka bertanda pertanyaannya, dan label asalnya", () => {
  const ramal = (series_id: string, ref_period: string, point: number): BarisRamalan => ({
    series_id,
    ref_period,
    model: "sama_terakhir",
    is_main: true,
    horizon: 1,
    point,
    lo80: null,
    hi80: null,
    origin_date: "2026-11-14",
  });
  const r = ringkasanCerita(
    { harga, kerja, ekonomi },
    { inflasi: ramal("bps_cpi_yoy_m", "2026-11", 3.3), pertumbuhan: ramal("bps_gdp_growth_q", "2026-Q4", 5.5) },
  )!;
  assert.deepEqual(r.kalimat.map(teks), [
    "Dibanding setahun lalu, harga barang naik rata-rata 3,2%: keranjang belanja yang dulu Rp100.000 kini sekitar Rp103.200.",
    "Dari setiap 100 orang yang bekerja atau mencari kerja, sekitar 5 belum mendapat pekerjaan, lebih sedikit dari rata-rata tahun 2000 sampai 2025.",
    "Ekonomi tumbuh 5,5%, lebih cepat dari rata-rata tahun 2000 sampai 2025.",
    "Ke depan, Con-Fore memperkirakan inflasi November 2026 sekitar 3,3%, dan pertumbuhan kuartal IV 2026 sekitar 5,5%.",
  ]);
  assert.equal(r.label, "Tiga kalimat pertama angka resmi BPS. Kalimat terakhir perkiraan Con-Fore, bukan angka resmi.");
  const kelas = r.kalimat.flat().filter((b) => typeof b !== "string").map((b) => (b as { kelas: string }).kelas);
  assert.deepEqual(kelas, ["harga", "kerja", "ekonomi", "ke-depan", "ke-depan"]);
});

test("tanpa perkiraan, label menyebut semua kalimat sebagai angka resmi", () => {
  const r = ringkasanCerita({ harga, kerja }, {})!;
  assert.equal(r.kalimat.length, 2);
  assert.equal(r.label, "Semua kalimat di atas angka resmi BPS.");
  assert.equal(ringkasanCerita({}, {}), null);
});

test("harga yang turun ditulis turun, dengan keranjang yang lebih murah", () => {
  const j = buatJawaban({
    topik: HARGA,
    meta: meta("bps_cpi_yoy_m", "yoy", "M", null),
    nilai: nilai("bps_cpi_yoy_m", "2026-10", -0.5, -0.4),
    titik: [["2026-10", -0.5]],
    tahunan: [],
    target: [],
  });
  assert.equal(j.kalimat, "Dibanding setahun lalu, harga barang dan jasa turun rata-rata 0,5%.");
  assert.match(j.contoh, /kini sekitar Rp99\.500\.$/);
  assert.deepEqual(j.banding, []);
  assert.equal(j.waktu, null);
  assert.equal(teks(ringkasanCerita({ harga: j }, {})!.kalimat[0]), "Dibanding setahun lalu, harga barang turun rata-rata 0,5%: keranjang belanja yang dulu Rp100.000 kini sekitar Rp99.500.");
});

test("arah banding dari angka yang tampil, dengan batas sedikit", () => {
  assert.equal(arahBanding(4.75, 2, 4.75, 2, "kerja"), "sama dengan");
  assert.equal(arahBanding(3.21, 1, 3.24, 1, "harga"), "sama dengan");
  assert.equal(arahBanding(3.0 + SEDIKIT, 2, 3.0, 2, "harga"), "sedikit lebih tinggi dari");
  assert.equal(arahBanding(3.3, 1, 3.0, 1, "harga"), "lebih tinggi dari");
  assert.equal(arahBanding(4.9, 1, 5.0, 1, "ekonomi"), "sedikit lebih lambat dari");
});

test("rata-rata jangka panjang butuh semua tahun", () => {
  assert.equal(rataJangkaPanjang(tahunan(5)), 5);
  assert.equal(rataJangkaPanjang(tahunan(5).slice(1)), null);
  assert.equal(rataJangkaPanjang([...tahunan(5), ["2026", 99]]), 5);
});

test("target: di atas, di bawah, titik tengah sasaran, dan tahun tanpa target", () => {
  assert.equal(kalimatTarget(HARGA, 4.2, "2026-10", TARGET), "Di atas sasaran pemerintah untuk akhir 2026, yaitu 1,5% sampai 3,5%.");
  assert.equal(kalimatTarget(HARGA, 3.7, "2026-10", TARGET), "Sedikit di atas sasaran pemerintah untuk akhir 2026, yaitu 1,5% sampai 3,5%.");
  assert.equal(kalimatTarget(KERJA, 4.0, "2026-08", TARGET), "Di bawah target pemerintah untuk 2026, yaitu 4,44% sampai 4,96%.");
  assert.equal(kalimatTarget(EKONOMI, 5.4, "2026-Q3", TARGET), "Sama dengan target pemerintah untuk seluruh 2026, yaitu 5,4%.");
  const tengah = [target("idn_cpi_eop_a", "pmk", { value: 2.5 })];
  assert.equal(kalimatTarget(HARGA, 3.2, "2026-10", tengah), "Di dalam sasaran pemerintah untuk akhir 2026, yaitu 1,5% sampai 3,5%.");
  assert.equal(kalimatTarget(HARGA, 3.2, "2027-01", TARGET), null);
});

test("waktu rilis tanpa jadwal resmi ditulis diperkirakan", () => {
  assert.equal(kalimatWaktu(meta("x", "yoy", "M", "2026-12-01T00:00:00"), undefined), "Rilis berikutnya diperkirakan 1 Desember 2026.");
});

test("kalimat jawaban tanpa kata vonis", () => {
  const semua = (j: Jawaban) => [j.kalimat, j.contoh, ...j.banding].join(" ");
  for (const j of [harga, kerja, ekonomi]) {
    assert.doesNotMatch(semua(j), /membaik|memburuk|solid|gagal|hancur|sebaiknya|real-time/);
  }
});

test("topik: alamat, dan pertanyaan pemilik setiap seri", () => {
  assert.equal(topikDari("kerja")?.tanya, "Susah cari kerja atau tidak?");
  assert.equal(topikDari("ke-depan"), undefined);
  assert.equal(topikSeri("bps_cpi_core_yoy_m")?.kunci, "harga");
  assert.equal(topikSeri("bps_formal_share_round")?.kunci, "kerja");
  assert.equal(topikSeri("chn_cli_m")?.kunci, "ekonomi");
  assert.equal(topikSeri("idn_cli_m"), undefined);
});
