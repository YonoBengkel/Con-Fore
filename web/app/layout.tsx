import type { Metadata, Viewport } from "next";
import { Gelasio, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { NavUtama } from "@/components/Klien";
import "./globals.css";

// Disajikan dari Vercel sendiri: unduhan dari Google hanya saat build, tanpa panggilan dari browser.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Gelasio({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

/** Tanda merek: garis luar segitiga keseimbangan. */
function TandaMerek() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 5 28 26H4Z" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: { default: "Con-Fore: ekonomi Indonesia dalam tiga angka", template: "%s | Con-Fore" },
  description:
    "Pertumbuhan, inflasi, dan pengangguran Indonesia dalam bahasa sehari-hari, diperbarui otomatis dari data publik. Situs independen, bukan situs resmi lembaga mana pun.",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  colorScheme: "dark",
};

// Memilih panel lensa sebelum halaman tampil, supaya ?lensa=target tidak berkedip.
const SKRIP_LENSA =
  "try{if(new URLSearchParams(location.search).get('lensa')==='target')document.documentElement.dataset.lensa='target'}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_LENSA }} />
      </head>
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
              <Link href="/" className="merek">
                <TandaMerek />
                Con-Fore
              </Link>
              <p>
                Con-Fore adalah situs independen. Bukan situs resmi BPS, Bank Indonesia, Kementerian
                Keuangan, IMF, atau lembaga lain mana pun, dan tidak didukung oleh lembaga-lembaga itu.
              </p>
              <p>
                Angka diolah dari data publik dengan menyebut sumbernya. Lihat{" "}
                <Link href="/sumber">Sumber data</Link> untuk atribusi dan syarat penggunaan, dan{" "}
                <Link href="/cara-kerja">Cara kerja</Link> untuk aturan skor.
              </p>
            </div>
            <nav aria-label="Jelajahi">
              <p className="kaki-judul">Jelajahi</p>
              <ul>
                <li>
                  <Link href="/">Data</Link>
                </li>
                <li>
                  <Link href="/prediksi">Prediksi</Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Proyek">
              <p className="kaki-judul">Proyek</p>
              <ul>
                <li>
                  <Link href="/cara-kerja">Cara kerja</Link>
                </li>
                <li>
                  <Link href="/sumber">Sumber data</Link>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
