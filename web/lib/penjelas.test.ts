import assert from "node:assert/strict";
import { test } from "node:test";
import { KELOMPOK_INFLASI, SERI_DITAUTKAN, kelompokHalaman } from "./konten.ts";
import { penjelasSeri } from "./penjelas.ts";

test("setiap seri yang ditautkan punya penjelas tiga bagian", () => {
  for (const seri of SERI_DITAUTKAN) {
    const p = penjelasSeri(seri);
    assert.ok(p, seri);
    assert.ok(p.ukur.length > 20 && p.cara.length > 20 && p.baca.length > 20, seri);
  }
});

test("kelompok inflasi membedakan perubahan setahun yang dirangkai dan perubahan bulanan resmi", () => {
  const [inti] = KELOMPOK_INFLASI;
  assert.match(penjelasSeri(inti.setahun)!.cara, /merangkai 12 perubahan bulanan/);
  assert.match(penjelasSeri(inti.sebulan)!.cara, /Data resmi BPS/);
});

test("seri tanpa penjelas tidak dikarang", () => {
  assert.equal(penjelasSeri("seri_baru_yang_belum_ada"), null);
});

test("penjelas tanpa kata vonis atau nasihat", () => {
  for (const seri of SERI_DITAUTKAN) {
    const { ukur, cara, baca } = penjelasSeri(seri)!;
    assert.doesNotMatch(`${ukur} ${cara} ${baca}`, /sebaiknya|hancur|gagal|solid|real-time|LIVE/, seri);
  }
});

test("kelompok halaman: tiga angka didahulukan, dan seri lain punya kelompok sendiri", () => {
  assert.equal(kelompokHalaman("bps_cpi_yoy_m")?.judul, "Tiga angka utama");
  assert.equal(kelompokHalaman("bps_cpi_core_yoy_m")?.judul, "Rincian inflasi");
  assert.equal(kelompokHalaman("wld_cpo_m")?.judul, "Harga komoditas dunia");
  assert.equal(kelompokHalaman("bps_formal_share_round")?.judul, "Pasar kerja");
  assert.equal(kelompokHalaman("eur_idr_d"), undefined);
  assert.ok(kelompokHalaman("bps_cpi_core_yoy_m")!.seri.some(([id]) => id === "bps_cpi_yoy_m"));
});
