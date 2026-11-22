import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { NavUtama } from "@/components/Klien";
import { DESKRIPSI_SITUS } from "@/lib/situs";
import "./globals.css";

// Plus Jakarta Sans buatan Tokotype (gaya 3, DESIGN.md). Disajikan dari Vercel sendiri: unduhan dari Google
// hanya saat build, tanpa panggilan dari browser.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

/** Tanda merek: segitiga, satu-satunya sisa segitiga keseimbangan (PRD 4.2). */
function TandaMerek() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 5 28 26H4Z" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: { default: "Con-Fore", template: "%s | Con-Fore" },
  description: DESKRIPSI_SITUS,
};

export const viewport: Viewport = {
  themeColor: "#f4f5f7",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={sans.variable}>
      <body>
        <a className="lewati" href="#isi">
          Langsung ke isi
        </a>
        <header className="kepala">
          <div className="wadah kepala-dalam">
            <Link href="/" className="merek">
              <TandaMerek />
              Con-Fore
            </Link>
            <NavUtama />
          </div>
        </header>
        <main id="isi" className="wadah">
          {children}
        </main>
        <footer className="kaki">
          <div className="wadah kaki-kisi">
            <div>
              <p>
                Con-Fore adalah situs independen. Bukan situs resmi BPS, Bank Indonesia, Kementerian Keuangan, IMF,
                atau lembaga lain mana pun, dan tidak didukung oleh lembaga-lembaga itu. Isinya penjelasan angka, bukan
                nasihat keuangan.
              </p>
              <p>
                Angka diolah dari data publik dengan menyebut sumbernya. Atribusi, syarat penggunaan, dan cara angkanya
                dihitung ada di <Link href="/tentang-data">Tentang data</Link>.
              </p>
            </div>
            <nav aria-label="Jelajahi">
              <ul>
                <li>
                  <Link href="/indonesia">Indonesia</Link>
                </li>
                <li>
                  <Link href="/indonesia/ke-depan">Perkiraan ke depan</Link>
                </li>
                <li>
                  <Link href="/tentang-data#label">Arti label</Link>
                </li>
                <li>
                  <Link href="/tentang-data#sumber">Sumber dan syarat</Link>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
