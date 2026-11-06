// Tes rincian inflasi. Jalankan: npm test (Node 24 membaca TypeScript langsung).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Titik } from "./data";
import { artinyaBuatmu } from "./konten.ts";
import { rincianInflasi } from "./rincian.ts";

const DATA: Record<string, Titik[]> = {
  bps_cpi_yoy_m: [["2026-09", 3.28], ["2026-10", 3.23]],
  bps_cpi_mom_m: [["2026-09", 0.3], ["2026-10", 0.22]],
  bps_cpi_core_yoy_m: [["2026-09", 2.8462], ["2026-10", 2.5692]],
  bps_cpi_core_mom_m: [["2026-09", 0.1], ["2026-10", 0.12]],
  bps_cpi_admin_yoy_m: [["2026-09", 3.25], ["2026-10", 3.2348]],
  bps_cpi_admin_mom_m: [["2026-09", 0], ["2026-10", 0.09]],
  bps_cpi_volatile_yoy_m: [["2026-09", 5.04], ["2026-10", 5.8177]],
  bps_cpi_volatile_mom_m: [["2026-09", 1.46], ["2026-10", 0.77]],
};
const seri = (data: Record<string, Titik[]>) => (id: string) => data[id] ?? [];

test("kalimat dan tabel memakai periode terakhir", () => {
  const hasil = rincianInflasi(seri(DATA));
  assert.equal(
    hasil?.kalimat,
    "Oktober 2026 dibanding Oktober 2025: inti naik sekitar 2,6%, harga diatur pemerintah naik sekitar 3,2%, dan harga bergejolak naik sekitar 5,8%.",
  );
  assert.deepEqual(hasil?.baris[0], { nama: "Umum", setahun: 3.23, sebulan: 0.22 });
  assert.deepEqual(hasil?.baris[1], { nama: "Inti", setahun: 2.5692, sebulan: 0.12 });
  assert.equal(hasil?.baris.length, 4);
});

test("turun dan hampir tidak berubah ditulis apa adanya", () => {
  const hasil = rincianInflasi(
    seri({
      ...DATA,
      bps_cpi_core_yoy_m: [["2026-10", -9.03]],
      bps_cpi_admin_yoy_m: [["2026-10", 0.04]],
    }),
  );
  assert.match(hasil?.kalimat ?? "", /inti turun sekitar 9,0%, harga diatur pemerintah hampir tidak berubah, dan/);
});

test("kelompok yang tertinggal menentukan periodenya, dan umum boleh kosong", () => {
  const hasil = rincianInflasi(
    seri({ ...DATA, bps_cpi_volatile_yoy_m: [["2026-09", 5.04]], bps_cpi_yoy_m: [["2026-10", 3.23]] }),
  );
  assert.equal(hasil?.periode, "2026-09");
  assert.deepEqual(hasil?.baris[0], { nama: "Umum", setahun: null, sebulan: 0.3 });
});

test("tanpa angka setahun, rincian tidak tampil", () => {
  assert.equal(rincianInflasi(seri({ ...DATA, bps_cpi_core_yoy_m: [] })), null);
  assert.equal(rincianInflasi(seri({})), null);
});

test("penjelasan kelompok menyebut pembanding yang benar", () => {
  assert.match(artinyaBuatmu("bps_cpi_core_yoy_m", 2.57) ?? "", /^Harga kelompok ini sekitar 2,6% lebih mahal dibanding setahun sebelumnya\./);
  assert.match(artinyaBuatmu("bps_cpi_admin_mom_m", -0.33) ?? "", /^Harga kelompok ini 0,33% lebih murah dibanding bulan sebelumnya\./);
  assert.match(artinyaBuatmu("bps_cpi_admin_mom_m", 0) ?? "", /^Harga kelompok ini hampir sama dengan bulan sebelumnya\./);
  assert.match(artinyaBuatmu("bps_cpi_mom_m", 0.22) ?? "", /^Rata-rata harga barang dan jasa 0,22% lebih mahal dibanding bulan sebelumnya\.$/);
});
