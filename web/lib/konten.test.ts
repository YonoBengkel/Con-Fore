// Tes keterangan jadwal rilis. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { MetaSeri } from "./data";
import { artinyaBuatmu, keteranganJadwal, labelSeri } from "./konten.ts";

test("contoh hitung inflasi memakai belanja Rp100.000 dari angka yang tampil", () => {
  assert.match(
    artinyaBuatmu("bps_cpi_yoy_m", 3.24) ?? "",
    /^Rata-rata harga barang dan jasa 3,2% lebih mahal dibanding setahun sebelumnya\. Belanjaan yang setahun lalu seharga Rp100\.000 kini sekitar Rp103\.200\./,
  );
  assert.match(artinyaBuatmu("bps_cpi_yoy_m", -0.5) ?? "", /0,5% lebih murah.*sekitar Rp99\.500\./);
});

test("contoh uang hanya untuk inflasi: PDB, BI-Rate, dan pengangguran tanpa rupiah", () => {
  for (const [seri, nilai] of [["bps_gdp_growth_q", 5.5], ["idn_policy_rate_m", 5.75], ["bps_unemp_round", 4.75]] as const) {
    assert.doesNotMatch(artinyaBuatmu(seri, nilai) ?? "", /Rp/, seri);
  }
  assert.match(artinyaBuatmu("bps_unemp_round", 4.75) ?? "", /Dari setiap 100 orang angkatan kerja/);
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
