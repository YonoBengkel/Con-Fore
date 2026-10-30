// Tab Prediksi menyusul di v0.2 (PRD 4.1). Halaman ini hanya penanda supaya tautannya tidak buntu.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Prediksi (segera)",
  description: "Tab Prediksi Con-Fore sedang disiapkan.",
};

export default function Prediksi() {
  return (
    <section className="pembuka prosa">
      <h1>Prediksi: segera hadir</h1>
      <p>
        Tab ini nanti berisi perkiraan pertumbuhan, inflasi, dan pengangguran, lengkap dengan rentang
        ketidakpastian, penjelasan penggerak terbesarnya, dan catatan seberapa sering perkiraan itu
        meleset. Setiap perkiraan akan diberi label &quot;perkiraan Con-Fore&quot; atau &quot;proyeksi
        IMF&quot;, bukan angka resmi.
      </p>
      <p>
        Sementara itu, kondisi terkini dari data yang sudah terbit ada di{" "}
        <Link href="/">tab Data</Link>.
      </p>
    </section>
  );
}
