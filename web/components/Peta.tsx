// Peta dunia diam, gambar pengganti globe di halaman depan (DESIGN.md). Tampil bila JavaScript mati atau globe gagal
// dimuat. Negara yang tersedia menyala dan terangkat saat kursor di atasnya. Nama negaranya tautan biasa, supaya bisa
// dibuka dengan keyboard dan pembaca layar, sedangkan gambarnya disembunyikan dari pembaca layar.

import Link from "next/link";
import { DARAT, INDONESIA, KOTAK_PETA } from "@/lib/peta";

type Props = {
  /** Tanpa nama Indonesia dan garis penunjuknya. Dipakai saat globe gagal dimuat, karena tautan nama di atas globe
   *  tetap ada di sana, jadi tidak perlu tautan kedua. */
  tanpaNama?: boolean;
};

export function PetaDunia({ tanpaNama = false }: Props) {
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
        {!tanpaNama && <line x1="290" y1="93.5" x2="290" y2="109" className="penunjuk" />}
      </svg>
      {!tanpaNama && (
        <Link className="label-indonesia" href="/indonesia">
          Indonesia
        </Link>
      )}
    </div>
  );
}
