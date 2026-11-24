"use client";

// Globe di halaman depan (DESIGN.md, Halaman depan dan globe). Bola kosong tampil lebih dulu, lalu kode dan data peta
// dimuat lewat import() dan menggambar negara di kanvas, yang bisa diputar dengan menyeretnya. Tanpa JavaScript, atau
// bila globe gagal dimuat, yang tampil peta diam (components/Peta.tsx). Nama negara yang tersedia ditulis di dekat
// globe sebagai tautan biasa untuk keyboard dan pembaca layar, sedangkan kanvasnya disembunyikan dari pembaca layar.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FocusEvent, useEffect, useRef, useState } from "react";
import { PetaDunia } from "@/components/Peta";
import type { PengaturGlobe, Putaran } from "@/lib/gambar-globe";

type Keadaan = "memuat" | "siap" | "gagal";

const KUERI_KURANGI_GERAK = "(prefers-reduced-motion: reduce)";
const KUERI_KURSOR = "(hover: hover) and (pointer: fine)";

/** Tanpa JavaScript, globe dan tautan di dekatnya disembunyikan, karena peta diam punya tautannya sendiri, dan
 *  legenda selebar peta. Gaya ini ditulis di noscript, bukan di @media (scripting: none), supaya berlaku juga di
 *  browser lama yang belum mengenal fitur media itu. Dengan JavaScript, React tidak pernah membuat isi noscript, jadi
 *  gaya ini tidak dipakai. */
const GAYA_TANPA_JS = ".negara-tersedia, .globe { display: none } .depan > .legenda { width: auto }";

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
  const putaran = useRef<Putaran>({ boleh: true });
  const sorotan = useRef({ kursor: false, fokus: false });
  const [keadaan, setKeadaan] = useState<Keadaan>("memuat");
  /** Naik setiap kali preferensi gerak atau jenis kursor berubah, supaya globe dipasang ulang dengan mode baru. */
  const [versiMode, setVersiMode] = useState(0);

  useEffect(() => {
    let batal = false;
    // Kurangi animasi bisa dinyalakan, atau mouse dicolokkan ke tablet, selagi halaman terbuka. Globe lalu dipasang
    // ulang dengan mode yang baru, tanpa memuat ulang halaman.
    const kueriGerak = window.matchMedia(KUERI_KURANGI_GERAK);
    const kueriKursor = window.matchMedia(KUERI_KURSOR);
    const pasangUlang = () => setVersiMode((versi) => versi + 1);
    kueriGerak.addEventListener("change", pasangUlang);
    kueriKursor.addEventListener("change", pasangUlang);
    import("@/lib/gambar-globe")
      .then(({ pasangGlobe, pilihMode }) => {
        if (batal || !kanvas.current) return;
        const kurangiGerak = kueriGerak.matches;
        const mode = pilihMode(kueriKursor.matches, kurangiGerak);
        pengatur.current = pasangGlobe(kanvas.current, mode, kurangiGerak, putaran.current, (tabBaru) => {
          // Alamatnya di situs sendiri, jadi tab baru tidak perlu diputus dari tab ini (noopener).
          if (tabBaru) window.open("/indonesia", "_blank");
          else router.push("/indonesia");
        });
        // Tautan nama bisa sudah disorot atau difokus sebelum kode globe selesai dimuat.
        if (sorotan.current.kursor || sorotan.current.fokus) pengatur.current.sorotTautan(true);
        setKeadaan("siap");
      })
      .catch(() => {
        if (!batal) setKeadaan("gagal");
      });
    return () => {
      batal = true;
      kueriGerak.removeEventListener("change", pasangUlang);
      kueriKursor.removeEventListener("change", pasangUlang);
      pengatur.current?.lepas();
      pengatur.current = null;
    };
  }, [router, versiMode]);

  /** Kursor dan fokus dicatat terpisah, supaya globe tidak berputar lagi selama salah satunya masih di tautan. */
  function sorot(asal: "kursor" | "fokus", ya: boolean) {
    sorotan.current[asal] = ya;
    pengatur.current?.sorotTautan(sorotan.current.kursor || sorotan.current.fokus);
  }

  /** Fokus keyboard menghentikan putaran seterusnya, karena pengguna keyboard tidak bisa menghentikannya dengan
   *  mengeklik bola. Fokus dari klik mouse tidak. */
  function saatFokus(e: FocusEvent<HTMLAnchorElement>) {
    sorot("fokus", true);
    if (e.currentTarget.matches(":focus-visible")) putaran.current.boleh = false;
  }

  return (
    <>
      <ul className="negara-tersedia" aria-label="Negara yang tersedia">
        <li>
          <Link
            href="/indonesia"
            onMouseEnter={() => sorot("kursor", true)}
            onMouseLeave={() => sorot("kursor", false)}
            onFocus={saatFokus}
            onBlur={() => sorot("fokus", false)}
          >
            Indonesia
          </Link>
        </li>
      </ul>
      {/* Bila globe gagal dimuat, hanya kanvasnya yang diganti peta diam. Tautan namanya tetap elemen yang sama, jadi
          fokus keyboard yang sedang ada di sana tidak hilang. */}
      {keadaan === "gagal" ? (
        <PetaDunia tanpaNama />
      ) : (
        <div className="globe" data-keadaan={keadaan}>
          <canvas ref={kanvas} aria-hidden="true" />
        </div>
      )}
      <noscript>
        <style>{GAYA_TANPA_JS}</style>
        <PetaDunia />
      </noscript>
      <Legenda />
    </>
  );
}
