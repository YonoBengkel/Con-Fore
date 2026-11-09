// Penutup setiap halaman utama: tautan ke langkah berikutnya, supaya alur antarhalaman terasa
// (PRD 4.1, dari uji baca lima orang 2026-11-09). Bentuknya sama dengan pintu penjelas.

import Link from "next/link";

export type TautanBerikutnya = { href: string; tanya: string; teks: string };

export function Berikutnya({ tautan }: { tautan: TautanBerikutnya[] }) {
  return (
    <nav aria-label="Berikutnya" className="berikutnya">
      <p className="berikutnya-judul">Berikutnya</p>
      <ul>
        {tautan.map((t) => (
          <li key={t.href}>
            <Link href={t.href}>
              <span className="berikutnya-tanya">{t.tanya}</span>
              <span className="berikutnya-teks">
                {t.teks} <span aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
