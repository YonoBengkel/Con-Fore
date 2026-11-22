// Halaman 404 berbahasa Indonesia, menggantikan teks bawaan Next.js.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

export default function TidakDitemukan() {
  return (
    <section className="pembuka">
      <h1>Halaman tidak ditemukan</h1>
      <p>
        Alamat ini tidak ada di Con-Fore. Coba mulai dari halaman <Link href="/indonesia">Indonesia</Link> atau{" "}
        <Link href="/">peta dunia</Link>.
      </p>
    </section>
  );
}
