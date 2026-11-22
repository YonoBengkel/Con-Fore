"use client";

// Dua komponen kecil yang butuh browser: menu utama dengan penanda halaman aktif, dan banner kesegaran data.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Menu atas hanya Indonesia dan Tentang data; logo kembali ke peta dunia (PRD 4.1). */
const MENU = [
  { href: "/indonesia", teks: "Indonesia", juga: "/indikator" },
  { href: "/tentang-data", teks: "Tentang data" },
];

export function NavUtama() {
  const jalur = usePathname();
  return (
    <nav aria-label="Utama" className="nav-utama">
      {MENU.map((m) => {
        const aktif = jalur.startsWith(m.href) || (m.juga != null && jalur.startsWith(m.juga));
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
