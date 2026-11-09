// Tes keterangan jadwal rilis. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { MetaSeri } from "./data";
import { arahInflasi, artinyaBuatmu, keteranganJadwal, labelSeri } from "./konten.ts";

test("kartu inflasi dibuka dengan perumpamaan keranjang belanja Rp100.000 dari angka yang tampil", () => {
  assert.match(
    artinyaBuatmu("bps_cpi_yoy_m", 3.24) ?? "",
    /^Bayangkan satu keranjang belanja yang isinya sama setiap bulan\. Inflasi 3,2% berarti keranjang yang setahun lalu Rp100\.000 kini sekitar Rp103\.200\. Kalau penghasilanmu naik kurang dari 3,2%/,
  );
  assert.match(artinyaBuatmu("bps_cpi_yoy_m", -0.5) ?? "", /sekitar Rp99\.500\. Rata-rata harga lebih murah/);
});

test("kartu pertumbuhan dan pengangguran dibuka dengan perumpamaan, tanpa contoh uang", () => {
  assert.match(artinyaBuatmu("bps_gdp_growth_q", 5.5) ?? "", /^Bayangkan .* sebagai satu kue\. Pertumbuhan 5,5% berarti kuenya 5,5% lebih besar/);
  assert.match(artinyaBuatmu("bps_unemp_round", 4.75) ?? "", /^Bayangkan 100 orang yang bekerja atau sedang mencari kerja\. Sekitar 5 di antaranya/);
  for (const [seri, nilai] of [["bps_gdp_growth_q", 5.5], ["idn_policy_rate_m", 5.75], ["bps_unemp_round", 4.75]] as const) {
    assert.doesNotMatch(artinyaBuatmu(seri, nilai) ?? "", /Rp/, seri);
  }
});

test("arah inflasi dalam bahasa sehari-hari mengikuti angka yang tampil", () => {
  assert.equal(arahInflasi(3.2, 3.3), "Harga masih naik, tetapi lebih lambat dibanding bulan lalu.");
  assert.equal(arahInflasi(3.4, 3.3), "Harga naik lebih cepat dibanding bulan lalu.");
  assert.equal(arahInflasi(3.24, 3.21), "Harga naik secepat bulan lalu.");
  assert.equal(arahInflasi(-0.2, 0.1), null);
  assert.equal(arahInflasi(3.2, null), null);
  assert.match(artinyaBuatmu("bps_cpi_yoy_m", 3.2, 3.3) ?? "", /Rp103\.200\. Harga masih naik, tetapi lebih lambat dibanding bulan lalu\. Kalau penghasilanmu/);
  assert.doesNotMatch(artinyaBuatmu("idn_cpi_eop_a", 3.2, 3.3) ?? "", /bulan lalu/);
});

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

test("seri proyeksi IMF berlabel proyeksi, bukan salinan data BPS", () => {
  const meta = { series_id: "idn_gdp_growth_weo_a", source_id: "imf", country: "IDN", citation: "International Monetary Fund" } as MetaSeri;
  assert.equal(labelSeri(meta), "proyeksi IMF");
  assert.equal(labelSeri({ ...meta, series_id: "idn_gdp_growth_a" }), "salinan IMF dari data BPS");
});
