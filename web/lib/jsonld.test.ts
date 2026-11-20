import assert from "node:assert/strict";
import { test } from "node:test";
import type { BarisRamalan, MetaSeri, NilaiTerakhir, Sumber } from "./data";
import { cakupanWaktu, isoPeriode, jsonLdPerkiraan, jsonLdSeri, tanggalUbah, teksJsonLd, terbaru } from "./jsonld.ts";

const meta = (ubah: Partial<MetaSeri> = {}): MetaSeri => ({
  series_id: "bps_cpi_yoy_m",
  source_id: "bps",
  country: "IDN",
  name_id: "Inflasi (dibanding bulan yang sama tahun lalu)",
  unit: "%",
  concept: "yoy",
  frequency: "M",
  citation: "Badan Pusat Statistik, Inflasi Tahunan, https://www.bps.go.id/id/statistics-table/2/abc.html",
  last_period: "2026-10",
  last_release_date: null,
  next_release_date: null,
  ...ubah,
});

const bps: Sumber = {
  source_id: "bps",
  name: "Badan Pusat Statistik (BPS)",
  url: "https://www.bps.go.id",
  terms_url: "https://webapi.bps.go.id/developer/",
  license: "Ketentuan Penggunaan WebAPI BPS",
  attribution_text: "Layanan ini menggunakan API Badan Pusat Statistik (BPS).",
};

const nilai = (ubah: Partial<NilaiTerakhir> = {}): NilaiTerakhir => ({
  series_id: "bps_cpi_yoy_m",
  period: "2026-10",
  value: 3.23,
  previous_value: 3.28,
  release_date: null,
  seen_date: "2026-11-03",
  source_id: "bps",
  is_stale: false,
  ...ubah,
});

/** JSON-LD dibaca kembali dari teks tag script-nya, seperti yang dibaca mesin pencari. */
const baca = (data: Record<string, unknown>) => JSON.parse(teksJsonLd(data));

test("periode menjadi batas ISO 8601, dengan kuartal sebagai bulan pertama atau terakhirnya", () => {
  assert.equal(isoPeriode("2026-Q3", "awal"), "2026-07");
  assert.equal(isoPeriode("2026-Q3", "akhir"), "2026-09");
  assert.equal(isoPeriode("2026-10", "akhir"), "2026-10");
  assert.equal(cakupanWaktu("2015-Q1", "2026-Q3"), "2015-01/2026-09");
  assert.equal(cakupanWaktu("2024-01-02", "2026-11-14"), "2024-01-02/2026-11-14");
});

test("tanggal ubah memakai hari pertama dilihat, lalu tanggal rilis, dan terbaru memilih yang paling akhir", () => {
  assert.equal(tanggalUbah(nilai()), "2026-11-03");
  assert.equal(tanggalUbah(nilai({ seen_date: null, release_date: "2026-11-02T00:00:00+00:00" })), "2026-11-02");
  assert.equal(tanggalUbah(undefined), undefined);
  assert.equal(terbaru(["2026-11-03", undefined, "2026-11-17T04:00:00Z", null]), "2026-11-17");
  assert.equal(terbaru([undefined]), undefined);
});

test("teks JSON-LD tidak bisa menutup tag script", () => {
  const isi = "</script><script>alert(1)</script>";
  const teks = teksJsonLd({ name: isi });
  assert.ok(!teks.includes("<"));
  assert.deepEqual(JSON.parse(teks), { name: isi });
});

test("dataset seri BPS: BPS pembuatnya, lisensinya halaman syarat, dan cakupan waktunya dari titik grafik", () => {
  const d = baca(jsonLdSeri(meta(), [["2024-01", 2.57], ["2026-10", 3.23]], nilai(), bps));
  assert.equal(d["@type"], "Dataset");
  assert.deepEqual(d.creator, { "@type": "Organization", name: "Badan Pusat Statistik (BPS)", url: "https://www.bps.go.id" });
  assert.equal(d.publisher.name, "Con-Fore");
  assert.equal(d.license, "https://webapi.bps.go.id/developer/");
  assert.equal(d.isBasedOn, "https://www.bps.go.id/id/statistics-table/2/abc.html");
  assert.equal(d.temporalCoverage, "2024-01/2026-10");
  assert.equal(d.dateModified, "2026-11-03");
  assert.equal(d.spatialCoverage.name, "Indonesia");
  assert.match(d.description, /^Inflasi \(dibanding bulan yang sama tahun lalu\) di Indonesia, Januari 2024 sampai Oktober 2026 \(%\)\. /);
  assert.match(d.description, /bukan situs resmi lembaga mana pun\.$/);
  assert.match(d.distribution.contentUrl, /\/api\/csv\/bps_cpi_yoy_m$/);
});

test("dataset seri olahan dibuat Con-Fore, dan seri dunia tanpa cakupan wilayah", () => {
  const olahan = baca(jsonLdSeri(meta({ citation: "Dihitung Con-Fore dari dua seri BPS" }), [], undefined, bps));
  assert.equal(olahan.creator.name, "Con-Fore");
  assert.equal(olahan.isBasedOn, undefined);
  assert.equal(olahan.temporalCoverage, undefined);
  assert.equal(olahan.dateModified, undefined);
  const dunia = baca(jsonLdSeri(meta({ series_id: "wld_coal_m", country: "WLD", source_id: "wb" }), [], undefined, undefined));
  assert.equal(dunia.spatialCoverage, undefined);
  assert.equal(dunia.creator, undefined);
  assert.equal(dunia.license, undefined);
  assert.doesNotMatch(dunia.description, /di Indonesia/);
});

test("dataset perkiraan: cakupan waktu dari jalur utama, tanggal dari hari dihitung, dan satu CSV per target", () => {
  const baris = (series_id: string, ref_period: string, is_main = true, origin_date = "2026-11-17"): BarisRamalan => ({
    series_id,
    ref_period,
    model: "ar1",
    is_main,
    horizon: 1,
    point: 1,
    lo80: null,
    hi80: null,
    origin_date,
  });
  const d = baca(
    jsonLdPerkiraan(
      [
        baris("bps_gdp_growth_q", "2026-Q4"),
        baris("bps_cpi_yoy_m", "2027-10"),
        baris("bps_cpi_yoy_m", "2028-01", false, "2026-11-18"),
        baris("bps_unemp_round", "2027-02", true, "2026-11-16"),
      ],
      [meta()],
    ),
  );
  assert.equal(d.temporalCoverage, "2026-10/2027-10");
  assert.equal(d.dateModified, "2026-11-17");
  assert.equal(d.license, undefined);
  assert.deepEqual(
    d.distribution.map((x: { contentUrl: string }) => x.contentUrl.split("/").pop()),
    ["pertumbuhan", "inflasi", "pengangguran"],
  );
  assert.equal(d.variableMeasured[1].unitText, "%");
});
