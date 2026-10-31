"use client";

// Dua komponen kecil yang butuh browser: banner kesegaran data dan pilihan lensa segitiga.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const MENU = [
  { href: "/", teks: "Data" },
  { href: "/prediksi", teks: "Prediksi", segera: true },
  { href: "/cara-kerja", teks: "Cara kerja" },
  { href: "/sumber", teks: "Sumber data" },
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
            {m.segera && <span className="segera">segera</span>}
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
 * Pilihan lensa disimpan di URL (?lensa=target). Kedua panel sudah ada di HTML; skrip kecil di
 * <head> memilih panel sebelum halaman tampil, dan komponen ini menggantinya tanpa memuat ulang.
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
    const url = new URL(window.location.href);
    if (l === "target") url.searchParams.set("lensa", "target");
    else url.searchParams.delete("lensa");
    window.history.replaceState(null, "", url);
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
      </a>
      <a
        href="?lensa=target"
        aria-current={lensa === "target" ? "true" : undefined}
        onClick={(e) => pilih(e, "target")}
      >
        Target resmi
      </a>
    </nav>
  );
}
