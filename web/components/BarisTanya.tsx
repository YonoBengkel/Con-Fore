// Baris empat pertanyaan (PRD 4.1): di halaman Indonesia menggulir ke bloknya, di halaman rinci pindah topik.

import Link from "next/link";

const PERTANYAAN = [
  { kunci: "harga", nama: "Harga" },
  { kunci: "kerja", nama: "Kerja" },
  { kunci: "ekonomi", nama: "Ekonomi" },
  { kunci: "ke-depan", nama: "Ke depan" },
];

export function BarisTanya({ kini, jangkar = false }: { kini?: string; jangkar?: boolean }) {
  return (
    <nav className={jangkar ? "baris-tanya" : "baris-tanya baris-atas"} aria-label="Empat pertanyaan">
      {PERTANYAAN.map((p) =>
        jangkar ? (
          <a key={p.kunci} href={`#${p.kunci}`} data-topik={p.kunci}>
            {p.nama}
          </a>
        ) : (
          <Link
            key={p.kunci}
            href={`/indonesia/${p.kunci}`}
            data-topik={p.kunci}
            aria-current={kini === p.kunci ? "page" : undefined}
          >
            {p.nama}
          </Link>
        ),
      )}
    </nav>
  );
}

/** Urutan pertanyaan untuk tautan "pertanyaan berikutnya" di akhir halaman rinci. */
export function pertanyaanBerikutnya(kunci: string): { href: string; nama: string } | null {
  const i = PERTANYAAN.findIndex((p) => p.kunci === kunci);
  const lanjut = i >= 0 ? PERTANYAAN[i + 1] : undefined;
  return lanjut ? { href: `/indonesia/${lanjut.kunci}`, nama: lanjut.nama } : null;
}
