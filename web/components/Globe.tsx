"use client";

// Globe di halaman depan (DESIGN.md, Halaman depan dan globe). Bola kosong tampil lebih dulu, lalu kode dan data peta
// dimuat lewat import() dan menggambar negara di kanvas. Tanpa JavaScript, atau bila globe gagal dimuat, yang tampil
// peta diam (components/Peta.tsx). Nama negara yang tersedia ditulis di atas globe sebagai tautan biasa untuk
// keyboard dan pembaca layar, sedangkan kanvasnya disembunyikan dari pembaca layar.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PetaDunia } from "@/components/Peta";
import type { PengaturGlobe } from "@/lib/gambar-globe";

type Keadaan = "memuat" | "siap" | "gagal";

function Legenda() {
  return (
    <p className="legenda">
      <span>
        <span className="kotak tersedia" aria-hidden="true" />
        Tersedia
      </span>
      <span>
        <span className="kotak belum" aria-hidden="true" />
        Belum tersedia
      </span>
    </p>
  );
}

export function GlobeDepan() {
  const router = useRouter();
  const kanvas = useRef<HTMLCanvasElement>(null);
  const pengatur = useRef<PengaturGlobe | null>(null);
  const sorotan = useRef({ kursor: false, fokus: false });
  /** Salinan `dihentikan` untuk efek, supaya globe yang dipasang ulang tetap berhenti bila tombolnya sudah ditekan. */
  const henti = useRef(false);
  const [keadaan, setKeadaan] = useState<Keadaan>("memuat");
  const [bisaBerputar, setBisaBerputar] = useState(false);
  const [dihentikan, setDihentikan] = useState(false);

  useEffect(() => {
    let batal = false;
    import("@/lib/gambar-globe")
      .then(({ pasangGlobe, pilihMode }) => {
        if (batal || !kanvas.current) return;
        const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const adaKursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        const mode = pilihMode(adaKursor, kurangiGerak);
        pengatur.current = pasangGlobe(kanvas.current, mode, kurangiGerak, () => router.push("/indonesia"));
        // Tautan nama bisa sudah disorot atau difokus sebelum kode globe selesai dimuat.
        if (sorotan.current.kursor || sorotan.current.fokus) pengatur.current.sorotTautan(true);
        if (henti.current) pengatur.current.aturPutar(false);
        setBisaBerputar(mode.berputar);
        setKeadaan("siap");
      })
      .catch(() => {
        if (!batal) setKeadaan("gagal");
      });
    return () => {
      batal = true;
      pengatur.current?.lepas();
      pengatur.current = null;
    };
  }, [router]);

  /** Kursor dan fokus dicatat terpisah, supaya globe tidak berputar lagi selama salah satunya masih di tautan. */
  function sorot(asal: "kursor" | "fokus", ya: boolean) {
    sorotan.current[asal] = ya;
    pengatur.current?.sorotTautan(sorotan.current.kursor || sorotan.current.fokus);
  }

  function gantiPutar() {
    henti.current = !henti.current;
    setDihentikan(henti.current);
    pengatur.current?.aturPutar(!henti.current);
  }

  if (keadaan === "gagal") {
    return (
      <>
        <PetaDunia />
        <Legenda />
      </>
    );
  }

  return (
    <>
      <ul className="negara-tersedia" aria-label="Negara yang tersedia">
        <li>
          <Link
            href="/indonesia"
            onMouseEnter={() => sorot("kursor", true)}
            onMouseLeave={() => sorot("kursor", false)}
            onFocus={() => sorot("fokus", true)}
            onBlur={() => sorot("fokus", false)}
          >
            Indonesia
          </Link>
        </li>
      </ul>
      <div className="globe" data-keadaan={keadaan}>
        <canvas ref={kanvas} aria-hidden="true" />
      </div>
      <noscript>
        <PetaDunia />
      </noscript>
      <div className="globe-bawah">
        <Legenda />
        {bisaBerputar && (
          <button type="button" className="tombol-putar" onClick={gantiPutar}>
            {dihentikan ? "Putar lagi" : "Hentikan putaran"}
          </button>
        )}
      </div>
    </>
  );
}
