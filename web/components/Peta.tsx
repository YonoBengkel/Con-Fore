// Peta dunia diam di halaman depan, pengganti sementara globe 3D (DESIGN.md). Negara yang tersedia menyala dan
// terangkat saat kursor di atasnya. Nama negaranya tautan biasa, supaya bisa dibuka dengan keyboard dan
// pembaca layar; gambarnya sendiri disembunyikan dari pembaca layar.

import Link from "next/link";
import { DARAT, INDONESIA, KOTAK_PETA } from "@/lib/peta";

export function PetaDunia() {
  return (
    <div className="peta">
      <svg viewBox={KOTAK_PETA} aria-hidden="true" focusable="false">
        <g className="darat">
          {DARAT.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <a href="/indonesia" tabIndex={-1} className="tautan-indonesia">
          <g className="indonesia">
            {INDONESIA.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </a>
        {/* Garis penunjuk dari nama Indonesia di Samudra Hindia ke pantai selatan Jawa. */}
        <line x1="290" y1="93.5" x2="290" y2="109" className="penunjuk" />
      </svg>
      <Link className="label-indonesia" href="/indonesia">
        Indonesia
      </Link>
    </div>
  );
}
