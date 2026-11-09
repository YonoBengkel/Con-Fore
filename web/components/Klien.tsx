"use client";

// Dua komponen kecil yang butuh browser: banner kesegaran data dan pilihan lensa segitiga.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TAHUN_AKHIR, TAHUN_AWAL } from "@/lib/skor";

const MENU = [
  { href: "/", teks: "Data" },
  { href: "/prediksi", teks: "Prediksi" },
  { href: "/metode", teks: "Metode" },
];

/** Navigasi utama dengan aria-current pada halaman yang sedang dibuka. */
export function NavUtama() {
  const jalur = usePathname();
  return (
    <nav aria-label="Utama" className="nav-utama">
      {MENU.map((m) => {
        const aktif = m.href === "/" ? jalur === "/" || jalur.startsWith("/indikator") : jalur.startsWith(m.href);
        return (
          <Link key={m.href} href={m.href} aria-current={aktif ? "page" : undefined}>
            {m.teks}
          </Link>
        );
      })}
    </nav>
  );
}

/** Batas yang sama dengan /api/health. */
const BATAS_JAM = 36;

/**
 * Dihitung di browser dari last_success_at, supaya banner tetap muncul walau halaman yang
 * di-cache sudah lama dan Supabase sedang mati (ARCHITECTURE 4.1).
 */
export function BannerBasi({ terakhir }: { terakhir: string }) {
  const [basi, setBasi] = useState(false);
  useEffect(() => {
    const umur = Date.now() - Date.parse(terakhir);
    setBasi(Number.isFinite(umur) && umur > BATAS_JAM * 3600 * 1000);
  }, [terakhir]);
  if (!basi) return null;
  return (
    <div className="banner banner-basi" role="status">
      <strong>Data mungkin belum diperbarui.</strong> Pembaruan otomatis terakhir berhasil lebih
      dari {BATAS_JAM} jam lalu, jadi angka di halaman ini bisa tertinggal dari rilis terbaru.
    </div>
  );
}

type KunciLensa = "masa-lalu" | "target";

function lensaDariUrl(): KunciLensa {
  return new URLSearchParams(window.location.search).get("lensa") === "target"
    ? "target"
    : "masa-lalu";
}

function terapkan(lensa: KunciLensa) {
  if (lensa === "target") document.documentElement.dataset.lensa = "target";
  else delete document.documentElement.dataset.lensa;
}

/**
 * Kedua panel lensa sudah ada di HTML. Skrip kecil di <head> memilih panel dari ?lensa=target sebelum
 * halaman tampil, dan komponen ini menggantinya tanpa memuat ulang dan tanpa mengubah alamat, karena
 * peserta uji baca membaca alamat yang berubah sebagai halaman lain (PRD 4.2).
 */
export function PilihLensa() {
  const [lensa, setLensa] = useState<KunciLensa>("masa-lalu");
  useEffect(() => {
    const sinkron = () => {
      const l = lensaDariUrl();
      terapkan(l);
      setLensa(l);
    };
    sinkron();
    window.addEventListener("popstate", sinkron);
    return () => window.removeEventListener("popstate", sinkron);
  }, []);

  function pilih(e: React.MouseEvent<HTMLAnchorElement>, l: KunciLensa) {
    e.preventDefault();
    terapkan(l);
    setLensa(l);
  }

  return (
    <nav className="pilih-lensa" aria-label="Pilih lensa skor">
      <a
        href="?"
        aria-current={lensa === "masa-lalu" ? "true" : undefined}
        onClick={(e) => pilih(e, "masa-lalu")}
      >
        Masa lalu
        <span className="lensa-ket">
          dibanding {TAHUN_AWAL}-{TAHUN_AKHIR}
        </span>
      </a>
      <a
        href="?lensa=target"
        aria-current={lensa === "target" ? "true" : undefined}
        onClick={(e) => pilih(e, "target")}
      >
        Target resmi
        <span className="lensa-ket">dibanding target pemerintah</span>
      </a>
    </nav>
  );
}
