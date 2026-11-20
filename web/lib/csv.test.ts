import assert from "node:assert/strict";
import { test } from "node:test";
import { kepalaSumber, komentar } from "./csv.ts";
import type { MetaSeri, Sumber } from "./data";

test("kepala CSV memuat seri lalu atribusi dan syarat sumbernya, satu baris per komentar", () => {
  const meta: MetaSeri[] = [
    {
      series_id: "bps_cpi_yoy_m",
      source_id: "bps",
      country: "IDN",
      name_id: "Inflasi",
      unit: "%",
      concept: "yoy",
      frequency: "M",
      citation: "BPS, tabel inflasi",
      last_period: null,
      last_release_date: null,
      next_release_date: null,
    },
  ];
  const sumber: Sumber[] = [
    {
      source_id: "bps",
      name: "BPS",
      url: "https://www.bps.go.id",
      terms_url: "https://webapi.bps.go.id/developer/",
      license: "Ketentuan\nWebAPI",
      attribution_text: "Wajib tampil.",
    },
  ];
  assert.deepEqual(kepalaSumber(["bps_cpi_yoy_m", "tidak_ada"], meta, sumber), [
    "# bps_cpi_yoy_m: Inflasi (%); data resmi BPS",
    "# Sitasi: BPS, tabel inflasi",
    "# Atribusi BPS: Wajib tampil.",
    "# Syarat penggunaan: Ketentuan WebAPI https://webapi.bps.go.id/developer/",
  ]);
  assert.equal(komentar("  dua\n baris  "), "# dua baris");
});
