import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { NavUtama } from "@/components/Klien";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Con-Fore: ekonomi Indonesia dalam tiga angka", template: "%s | Con-Fore" },
  description:
    "Pertumbuhan, inflasi, dan pengangguran Indonesia dalam bahasa sehari-hari, diperbarui otomatis dari data publik. Situs independen, bukan situs resmi lembaga mana pun.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#131517" },
  ],
};

// Memilih panel lensa sebelum halaman tampil, supaya ?lensa=target tidak berkedip.
const SKRIP_LENSA =
  "try{if(new URLSearchParams(location.search).get('lensa')==='target')document.documentElement.dataset.lensa='target'}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
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
              Con-Fore
              <span className="merek-sub">ekonomi Indonesia dalam tiga angka</span>
            </Link>
            <NavUtama />
          </div>
        </header>
        <main id="isi" className="wadah">
          {children}
        </main>
        <footer className="kaki">
          <div className="wadah">
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
        </footer>
      </body>
    </html>
  );
}
