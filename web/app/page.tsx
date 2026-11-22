// Halaman depan (PRD 4.1): judul yang menyebut topik situs, dan peta dunia dengan Indonesia sebagai satu-satunya
// negara yang tersedia. Globe 3D menggantikan peta ini begitu asetnya ada (DESIGN.md). Tidak membaca Supabase.

import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PetaDunia } from "@/components/Peta";
import { jsonLdSitus } from "@/lib/jsonld";
import { DESKRIPSI_SITUS } from "@/lib/situs";

export const metadata: Metadata = {
  title: { absolute: "Con-Fore: kondisi ekonomi tiap negara, mulai dari Indonesia" },
};

export default function HalamanDepan() {
  return (
    <>
      <JsonLd data={jsonLdSitus(DESKRIPSI_SITUS)} />
      <section className="depan" aria-labelledby="judul-depan">
        <h1 id="judul-depan">Penasaran bagaimana kondisi ekonomi tiap negara? Mari cari tahu</h1>
        <PetaDunia />
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
        <p className="sr-only">Peta dunia. Baru Indonesia yang tersedia, negara lain belum.</p>
      </section>
    </>
  );
}
