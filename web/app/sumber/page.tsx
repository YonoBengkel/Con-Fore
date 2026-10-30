// Sumber data: atribusi wajib per sumber, seri yang dipakai, dan tabel target resmi.

import type { Metadata } from "next";
import { Sitasi, TabelTarget } from "@/components/Kartu";
import { bacaMeta, bacaSumber, bacaTarget } from "@/lib/data";
import { labelSeri } from "@/lib/konten";

// 6 jam; pipeline memanggil /api/revalidate setelah setiap publikasi.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Sumber data",
  description: "Daftar sumber data Con-Fore, kalimat atribusi wajib, syarat penggunaan, dan tabel target resmi.",
};

export default async function Sumber() {
  const [sumber, meta, target] = await Promise.all([bacaSumber(), bacaMeta(), bacaTarget()]);
  const adaBps = meta.some((m) => m.source_id === "bps");
  return (
    <>
      <section className="pembuka prosa">
        <h1>Sumber data</h1>
        <p>
          Con-Fore adalah situs independen. Semua angka diambil dari data publik lembaga di bawah ini,
          diolah seperlunya, dan selalu disertai sumbernya. Situs ini bukan situs resmi BPS, Bank
          Indonesia, Kementerian Keuangan, atau lembaga mana pun di halaman ini.
        </p>
        {adaBps ? (
          <p>
            Angka berlabel &quot;data resmi BPS&quot; diambil langsung dari BPS. Angka Indonesia
            berlabel &quot;salinan IMF dari data BPS&quot; adalah terbitan ulang IMF, yang biasanya
            muncul beberapa minggu setelah rilis BPS.
          </p>
        ) : (
          <p>
            Data BPS belum diambil langsung. Sampai saat itu, angka pertumbuhan, inflasi, dan
            pengangguran Indonesia adalah salinan IMF dari data BPS, yang biasanya terbit beberapa
            minggu setelah rilis BPS.
          </p>
        )}
      </section>

      <section aria-labelledby="judul-lembaga">
        <h2 id="judul-lembaga">Lembaga sumber</h2>
        <ul className="daftar-sumber">
          {sumber.map((s) => {
            const seri = meta.filter((m) => m.source_id === s.source_id);
            return (
              <li key={s.source_id} className="panel">
                <h3>
                  <a href={s.url} rel="noopener noreferrer">
                    {s.name}
                  </a>
                </h3>
                <p>
                  <strong>Atribusi:</strong> {s.attribution_text}
                </p>
                <p>
                  <strong>Syarat penggunaan:</strong> {s.license}{" "}
                  <a href={s.terms_url} rel="noopener noreferrer">
                    Baca syarat lengkapnya
                  </a>
                  .
                </p>
                {seri.length > 0 && (
                  <details>
                    <summary>{seri.length} seri yang dipakai</summary>
                    <ul>
                      {seri.map((m) => (
                        <li key={m.series_id}>
                          {m.name_id} ({labelSeri(m)}). <Sitasi teks={m.citation} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
        <p className="catatan">
          Unduhan CSV di situs ini memuat sumber dan syarat penggunaan di baris-baris awalnya. Bila
          kamu menyebarkan ulang data itu, sebutkan sumber aslinya dan nyatakan bila datanya kamu ubah.
        </p>
      </section>

      <section aria-labelledby="target">
        <h2 id="target">Target resmi</h2>
        <p className="catatan prosa">
          Target pertumbuhan dan pengangguran diambil dari UU APBN, sasaran inflasi dari PMK, dan
          target jangka menengah dari Perpres RPJMN. Target yang statusnya &quot;dari pemberitaan&quot;
          masih bersumber berita dan akan dicocokkan ke teks resminya sebelum situs dirilis publik.
        </p>
        <TabelTarget target={target} judul="Semua target resmi yang dipakai Con-Fore" />
      </section>
    </>
  );
}
