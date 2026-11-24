import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ALAMAT_BANDING,
  ISI_BANDING,
  NEGARA_BANDING,
  barisBanding,
  daftarDefinisi,
  kalimatBanding,
  kalimatDefinisi,
  labelTerbit,
  negaraDari,
  seriProyeksi,
  teksGrafikBanding,
  terbitProyeksi,
  type BarisBanding,
} from "./banding.ts";
import type { MetaSeri, Titik } from "./data";
import { TOPIK } from "./konten.ts";
import type { NilaiTahun } from "./prediksi.ts";

const baris = (tahun: number, indonesia: number, lain: number): BarisBanding => ({ tahun, indonesia, lain, conFore: null });

test("setiap pasangan memakai seri yang terdaftar di pipeline", () => {
  const registri = readFileSync(new URL("../../config/series.toml", import.meta.url), "utf8");
  for (const awalan of ["idn", ...NEGARA_BANDING.map((n) => n.awalan)]) {
    for (const t of TOPIK) {
      assert.match(registri, new RegExp(`^id = "${seriProyeksi(t.kartu, awalan)}"`, "m"));
    }
  }
  assert.equal(seriProyeksi("inflasi", "mys"), "mys_cpi_eop_weo_a");
});

test("alamat di menu, pengalihan, dan pemanasan pipeline cocok dengan daftar negara", () => {
  const isi = (berkas: string) => readFileSync(new URL(berkas, import.meta.url), "utf8");
  assert.ok(isi("../components/Klien.tsx").includes(`href: "${ALAMAT_BANDING}"`));
  assert.ok(isi("../next.config.ts").includes(`destination: "${ALAMAT_BANDING}"`));
  const pemanasan = isi("../../confore/revalidate.py").match(/"\/banding\/[a-z]+"/g);
  assert.deepEqual(pemanasan, NEGARA_BANDING.map((n) => `"/banding/${n.kunci}"`));
});

test("alamat negara dikenali, dan selain itu tidak ada", () => {
  assert.equal(ALAMAT_BANDING, "/banding/malaysia");
  assert.equal(negaraDari("filipina")?.nama, "Filipina");
  assert.equal(negaraDari("indonesia"), undefined);
  assert.equal(new Set(NEGARA_BANDING.map((n) => n.awalan)).size, 4);
});

test("tanggal terbit satu edisi sama untuk semua seri yang berhasil diambil", () => {
  const meta = (series_id: string, last_release_date: string | null) => ({ series_id, last_release_date }) as MetaSeri;
  const semua = [
    meta("idn_unemp_weo_a", null),
    meta("tha_unemp_weo_a", "2026-04-14"), // angkanya tidak berubah di edisi Oktober
    meta("mys_unemp_weo_a", "2026-10-13"),
    meta("bps_cpi_yoy_m", "2026-11-02"), // bukan proyeksi
  ];
  assert.deepEqual([...terbitProyeksi(semua, new Set())], [
    ["idn_unemp_weo_a", "2026-10-13"],
    ["tha_unemp_weo_a", "2026-10-13"],
    ["mys_unemp_weo_a", "2026-10-13"],
  ]);
  assert.equal(terbitProyeksi([meta("idn_unemp_weo_a", null)], new Set()).size, 0);
});

test("seri yang gagal diambil memakai tanggal terbitnya sendiri, bukan tanggal edisi baru", () => {
  const meta = (series_id: string, last_release_date: string) => ({ series_id, last_release_date }) as MetaSeri;
  const semua = [meta("idn_cpi_eop_weo_a", "2027-04-14"), meta("mys_cpi_eop_weo_a", "2026-10-13")];
  const terbit = terbitProyeksi(semua, new Set(["mys_cpi_eop_weo_a"]));
  assert.equal(terbit.get("idn_cpi_eop_weo_a"), "2027-04-14");
  assert.equal(terbit.get("mys_cpi_eop_weo_a"), "2026-10-13");
  assert.equal(
    labelTerbit("Malaysia", "2027-04-14", "2026-10-13"),
    "Proyeksi IMF, terbit 14 April 2027 untuk Indonesia dan 13 Oktober 2026 untuk Malaysia",
  );
  assert.equal(labelTerbit("Malaysia", "2026-10-13", "2026-10-13"), "Proyeksi IMF, terbit 13 Oktober 2026");
  // Keduanya gagal: keduanya tetap memakai tanggal edisi lamanya.
  assert.deepEqual([...new Set(terbitProyeksi(semua, new Set(semua.map((m) => m.series_id))).values())], ["2027-04-14", "2026-10-13"]);
});

test("baris mulai tahun terbit, hanya tahun yang ada di kedua negara, dan dibulatkan seperti yang tampil", () => {
  const indonesia: Titik[] = [["2025", 5.1], ["2026", 5.142], ["2027", 5.104], ["2028", 2.55], ["2031", 5.2]];
  const lain: Titik[] = [["2025", 5.1], ["2026", 5.2], ["2027", -0.04], ["2028", 2.45], ["2032", 4]];
  assert.deepEqual(barisBanding(indonesia, lain, 2026, "pertumbuhan", new Map()), [
    baris(2026, 5.1, 5.2),
    baris(2027, 5.1, 0), // -0,04 tampil 0,0%, tanpa tanda minus
    baris(2028, 2.6, 2.5), // sama dengan Intl, bukan toFixed yang memberi 2,5
  ]);
  assert.ok(Object.is(barisBanding(indonesia, lain, 2026, "pertumbuhan", new Map())[1].lain, 0));
  assert.deepEqual(barisBanding(indonesia, [], 2026, "pertumbuhan", new Map()), []);
});

test("perkiraan Con-Fore hanya di tahun yang diramal, bukan di tahun yang angka resminya sudah terbit", () => {
  const imf: Titik[] = [["2026", 4.7], ["2027", 4.7], ["2028", 4.7]];
  const perTahun = new Map<number, NilaiTahun>([
    [2026, { pertumbuhan: { nilai: 5.46, resmi: false }, inflasi: null, pengangguran: { nilai: 4.75, resmi: true } }],
    [2027, { pertumbuhan: { nilai: 5.44, resmi: false }, inflasi: { nilai: 2.96, resmi: false }, pengangguran: null }],
  ]);
  const conFore = (kartu: "pertumbuhan" | "inflasi" | "pengangguran") =>
    barisBanding(imf, imf, 2026, kartu, perTahun).map((b) => b.conFore);
  assert.deepEqual(conFore("pertumbuhan"), [5.5, 5.4, null]);
  assert.deepEqual(conFore("inflasi"), [null, 3, null]);
  assert.deepEqual(conFore("pengangguran"), [null, null, null]);
});

test("kalimat menyebut tahun pertama dan terakhir dengan selisih dari angka yang tampil", () => {
  assert.equal(
    kalimatBanding("inflasi", "Malaysia", [baris(2026, 3.2, 3.6), baris(2027, 2.6, 0.3), baris(2031, 2.5, 2)]),
    "Menurut proyeksi IMF, inflasi 2026 di Indonesia 3,2% dan di Malaysia 3,6%, selisih 0,4 poin persen. Untuk 2031, Indonesia 2,5% dan Malaysia 2,0%, selisih 0,5 poin persen.",
  );
  assert.equal(
    kalimatBanding("pertumbuhan", "Vietnam", [baris(2026, 5.1, 5.1), baris(2031, 5.2, 5.2)]),
    "Menurut proyeksi IMF, pertumbuhan 2026 di Indonesia dan Vietnam sama-sama 5,1%. Untuk 2031, keduanya 5,2%.",
  );
  assert.equal(
    kalimatBanding("pengangguran", "Thailand", [baris(2031, 4.7, 1)]),
    "Menurut proyeksi IMF, pengangguran 2031 di Indonesia 4,7% dan di Thailand 1,0%, selisih 3,7 poin persen.",
  );
});

test("kalimat tanpa vonis menang atau kalah", () => {
  for (const t of TOPIK) {
    const teks = kalimatBanding(ISI_BANDING[t.kunci].subjek, "Filipina", [baris(2026, 5, 3), baris(2031, 4, 6)]);
    assert.doesNotMatch(teks, /menang|kalah|unggul|tertinggal|lebih baik|lebih buruk|sebaiknya/i);
  }
});

test("teks grafik menyebut kedua negara, tahun, dan gerak angkanya", () => {
  assert.equal(
    teksGrafikBanding("Inflasi akhir tahun", "Thailand", [baris(2026, 3.2, 4), baris(2027, 2.6, -0.6)]),
    "Grafik proyeksi IMF, 2026 sampai 2027. Inflasi akhir tahun. Indonesia dari 3,2% ke 2,6%, Thailand dari 4,0% ke -0,6%.",
  );
});

test("perbedaan definisi pengangguran tertulis untuk setiap pasangan", () => {
  for (const n of NEGARA_BANDING) {
    const teks = kalimatDefinisi(n);
    assert.match(teks, new RegExp(`Indonesia dan ${n.nama} tidak dihitung dengan cara yang sama`));
    assert.equal(/ILO/.test(teks), n.kunci === "filipina");
    const daftar = daftarDefinisi(n);
    for (const d of daftar) {
      assert.ok(d.isi.length > 80 && d.sumber);
      assert.match(d.url, /^https:\/\//);
    }
    // Definisi di balik angkanya selalu ada. Untuk Filipina itu definisi ILO, sebelum definisi nasionalnya.
    assert.deepEqual(
      daftar.map((d) => d.nama),
      n.kunci === "filipina"
        ? ["Indonesia", "Filipina, definisi ILO yang dipakai IMF", "Filipina, definisi nasional"]
        : ["Indonesia", n.nama],
    );
  }
});

test("teks halaman mengikuti gaya situs: tanpa tanda pisah dan titik koma", () => {
  const semua = [
    ...Object.values(ISI_BANDING).flatMap((x) => Object.values(x)),
    ...NEGARA_BANDING.flatMap((n) => daftarDefinisi(n).flatMap((x) => [x.nama, x.isi, x.sumber])),
    ...NEGARA_BANDING.map(kalimatDefinisi),
  ];
  for (const teks of semua) assert.doesNotMatch(teks, /[–—;]/);
});
