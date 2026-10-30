// Salin hanya SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY dari ../.env ke .env.local.
// Nilainya tidak pernah dicetak. .env.local diabaikan git lewat pola .env.* di .gitignore akar.
import { readFileSync, writeFileSync } from "node:fs";

const NAMA = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"];
const sumber = new URL("../../.env", import.meta.url);
const tujuan = new URL("../.env.local", import.meta.url);

let isi;
try {
  isi = readFileSync(sumber, "utf8").replace(/^﻿/, "");
} catch {
  console.error("../.env tidak ditemukan. Isi dulu .env di akar repo (lihat .env.example).");
  process.exit(1);
}

const nilai = new Map();
for (const mentah of isi.split(/\r?\n/)) {
  const baris = mentah.trim().replace(/^export\s+/, "");
  const sama = baris.indexOf("=");
  if (!baris || baris.startsWith("#") || sama < 0) continue;
  const nama = baris.slice(0, sama).trim();
  if (NAMA.includes(nama)) nilai.set(nama, baris.slice(sama + 1).trim());
}

const kurang = NAMA.filter((n) => !nilai.get(n));
if (kurang.length) {
  console.error(`Belum diisi di ../.env: ${kurang.join(", ")}`);
  process.exit(1);
}

writeFileSync(tujuan, NAMA.map((n) => `${n}=${nilai.get(n)}`).join("\n") + "\n", { mode: 0o600 });
console.log(`.env.local ditulis berisi ${NAMA.join(" dan ")} (nilai tidak ditampilkan).`);
