// Tes aturan skor segitiga. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gabungTahunan,
  persentil,
  skorMasaLalu,
  skorTarget,
  tahunLengkap,
  zonaTarget,
} from "./skor.ts";

test("persentil: terbaik, terburuk, dan tengah", () => {
  const acuan = [1, 2, 3, 4];
  assert.equal(persentil(4, acuan), 87.5);
  assert.equal(persentil(1, acuan), 12.5);
  assert.equal(persentil(2.5, acuan), 50);
});

test("lensa masa lalu: arah tiap dimensi dan patokan inflasi 2,5", () => {
  const data = gabungTahunan(
    [["2000", 4], ["2001", 6], ["2002", 5]],
    [["2000", 9], ["2001", 2.5], ["2002", 4]],
    [["2000", 8], ["2001", 6], ["2002", 4]],
  );
  assert.equal(tahunLengkap(data), 2002);
  const s = skorMasaLalu(2001, data)!;
  assert.ok(s.pertumbuhan > 80, "pertumbuhan tertinggi paling baik");
  assert.ok(s.harga > 80, "inflasi tepat di patokan paling stabil");
  assert.equal(s.kerja, 50);
  const t = skorMasaLalu(2002, data)!;
  assert.ok(t.kerja > 80, "pengangguran terendah paling baik");
});

test("lensa target: 100 di zona, turun 25 per poin persen, minimal 0", () => {
  const zona = { pertumbuhanMin: 5.2, inflasiTengah: 2.5, tptBatasAtas: 5 };
  assert.deepEqual(skorTarget({ pertumbuhan: 5.2, inflasi: 3.5, pengangguran: 5 }, zona), {
    pertumbuhan: 100,
    harga: 100,
    kerja: 100,
  });
  const s = skorTarget({ pertumbuhan: 4.2, inflasi: 0.5, pengangguran: 7 }, zona);
  assert.equal(s.pertumbuhan, 75);
  assert.equal(s.harga, 75);
  assert.equal(s.kerja, 50);
  assert.equal(skorTarget({ pertumbuhan: -2, inflasi: 2.5, pengangguran: 5 }, zona).pertumbuhan, 0);
});

test("zona target hanya ada bila ketiga target tahun itu lengkap", () => {
  const baris = [
    { series_id: "idn_gdp_growth_a", year: 2025, target_kind: "apbn", value: 5.2, lower: null, upper: null },
    { series_id: "idn_cpi_eop_a", year: 2025, target_kind: "pmk", value: 2.5, lower: 1.5, upper: 3.5 },
    { series_id: "idn_unemp_a", year: 2025, target_kind: "apbn", value: null, lower: 4.5, upper: 5 },
    { series_id: "idn_gdp_growth_a", year: 2025, target_kind: "rpjmn", value: 5.3, lower: null, upper: null },
  ];
  assert.deepEqual(zonaTarget(baris, 2025)?.zona, {
    pertumbuhanMin: 5.2,
    inflasiTengah: 2.5,
    tptBatasAtas: 5,
  });
  assert.equal(zonaTarget(baris.slice(0, 2), 2025), null);
  assert.equal(zonaTarget(baris, 2024), null);
});
