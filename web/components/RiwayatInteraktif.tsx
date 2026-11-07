"use client";

// Grafik riwayat dengan penggeser: pilih satu periode, dan kalimat di bawahnya menjelaskan angka periode itu.
// Tanpa JavaScript tetap tampil dengan periode terakhir. Penggeser bisa dipakai dengan keyboard dan tombol.

import { useState } from "react";
import { periode } from "@/lib/format";
import { kalimatPeriode, type BarisRiwayat } from "@/lib/riwayat";
import { GrafikRiwayat, POSISI_RIWAYAT } from "./Grafik";

export function RiwayatInteraktif({
  baris,
  nama,
  satuan,
  konsep,
  frekuensi,
}: {
  baris: BarisRiwayat[];
  nama: string;
  satuan: string;
  konsep: string;
  frekuensi: string;
}) {
  const akhir = baris.length - 1;
  const [dipilih, setDipilih] = useState(akhir);
  const kalimat = kalimatPeriode(baris[dipilih], satuan, konsep, frekuensi);

  function ikutiPenunjuk(e: React.PointerEvent<HTMLDivElement>) {
    const kotak = e.currentTarget.getBoundingClientRect();
    const { lebarGambar, kiri, lebar } = POSISI_RIWAYAT;
    const x = ((e.clientX - kotak.left) / kotak.width) * lebarGambar;
    setDipilih(Math.max(0, Math.min(akhir, Math.round(((x - kiri) / lebar) * akhir))));
  }

  return (
    <>
      <div className="riwayat-gambar" onPointerMove={ikutiPenunjuk} onPointerDown={ikutiPenunjuk}>
        <GrafikRiwayat titik={baris.map((b) => [b[0], b[1]])} nama={nama} konsep={konsep} sorot={dipilih} />
      </div>
      <div className="penggeser">
        <button type="button" onClick={() => setDipilih(Math.max(0, dipilih - 1))} disabled={dipilih === 0}>
          <span aria-hidden="true">&lsaquo;</span>
          <span className="sr-only">Periode sebelumnya</span>
        </button>
        <input
          type="range"
          min={0}
          max={akhir}
          value={dipilih}
          onChange={(e) => setDipilih(Number(e.target.value))}
          aria-label={`Pilih periode ${nama}`}
          aria-valuetext={kalimat}
        />
        <button type="button" onClick={() => setDipilih(Math.min(akhir, dipilih + 1))} disabled={dipilih === akhir}>
          <span aria-hidden="true">&rsaquo;</span>
          <span className="sr-only">Periode berikutnya</span>
        </button>
        <span className="penggeser-periode">{periode(baris[dipilih][0])}</span>
      </div>
      <p className="kalimat-periode">{kalimat}</p>
    </>
  );
}
