// Halaman Indonesia (PRD 4.1), bentuk C yang lulus uji konsep: ringkasan bercerita, baris empat pertanyaan,
// lalu blok jawaban. Tiga pertanyaan pertama memakai angka resmi terakhir, dan Ke depan memakai perkiraan.
// Di layar lebar, ringkasan ada di kiri dan keempat blok jawaban di sampingnya (DESIGN.md, Tata letak).

import type { Metadata } from "next";
import Link from "next/link";
import { BarisTanya } from "@/components/BarisTanya";
import { IsiJawaban, KalimatCerita } from "@/components/Jawaban";
import { BannerBasi } from "@/components/Klien";
import { tanggal, tanggalWIB } from "@/lib/format";
import { ringkasanCerita } from "@/lib/jawaban";
import { SERI_KARTU, TOPIK, namaPendek } from "@/lib/konten";
import { muatIndonesia } from "@/lib/muat";
import { penjelasSeri } from "@/lib/penjelas";
import { ARTI_KEMUNGKINAN, TANPA_RENTANG, kalimatPerkiraan, kalimatRentang } from "@/lib/prediksi";

// 6 jam; pipeline memanggil /api/revalidate setelah setiap publikasi.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Indonesia",
  description:
    "Harga barang naik berapa, susah cari kerja atau tidak, ekonomi tumbuh cepat atau lambat, dan ke depan bagaimana: jawaban dari angka resmi terakhir dan perkiraan Con-Fore.",
};

export default async function Indonesia() {
  const { status, jawaban, perkiraan } = await muatIndonesia();
  const cerita = ringkasanCerita(jawaban, { inflasi: perkiraan.harga, pertumbuhan: perkiraan.ekonomi });
  const dihitung = (perkiraan.harga ?? perkiraan.ekonomi ?? perkiraan.kerja)?.origin_date;

  return (
    <div className="negara">
      <div className="negara-awal">
        <h1>Indonesia</h1>
        <p className="data-per">Angka per {tanggalWIB(status.last_success_at)}</p>
        <BannerBasi terakhir={status.last_success_at} />
        {status.stale_sources.length > 0 && (
          <div className="banner" role="note">
            Sebagian angka dari {status.stale_sources.map(namaPendek).join(", ")} belum berhasil diperbarui. Angka yang
            terdampak ditandai &quot;terlambat diperbarui&quot;.
          </div>
        )}

        {cerita && (
          <section className="cerita" aria-label="Ringkasan">
            <KalimatCerita kalimat={cerita.kalimat} />
            <p className="label-angka">{cerita.label}</p>
          </section>
        )}
      </div>

      <div className="negara-jawaban">
        <BarisTanya jangkar />

        <div className="kisi-jawaban">
          {TOPIK.map((t) => {
            const j = jawaban[t.kunci];
            const p = penjelasSeri(j?.meta.series_id ?? SERI_KARTU[t.kartu][0]);
            return (
              <section
                key={t.kunci}
                id={t.kunci}
                className="blok"
                data-topik={t.kunci}
                aria-labelledby={`judul-${t.kunci}`}
              >
                <h2 id={`judul-${t.kunci}`}>{t.tanya}</h2>
                {j ? (
                  <IsiJawaban j={j} />
                ) : (
                  <p>Angka ini belum tersedia. Bagian ini terisi setelah pembaruan otomatis berikutnya berhasil.</p>
                )}
                {p && (
                  <details className="lipat">
                    <summary>{t.judulPenjelas}</summary>
                    <p>
                      <strong>Yang diukur:</strong> {p.ukur}
                    </p>
                    <p>
                      <strong>Cara membacanya:</strong> {p.baca}
                    </p>
                  </details>
                )}
                <p className="tautan-rinci">
                  <Link href={`/indonesia/${t.kunci}`}>
                    Lihat rincian {t.nama.toLowerCase()}
                    <span aria-hidden="true"> &rarr;</span>
                  </Link>
                </p>
              </section>
            );
          })}

          <section id="ke-depan" className="blok" data-topik="ke-depan" aria-labelledby="judul-ke-depan">
            <h2 id="judul-ke-depan">Ke depan bagaimana?</h2>
            {dihitung ? (
              <>
                <p className="jawaban">Ini perkiraan Con-Fore untuk beberapa bulan ke depan.</p>
                <ul className="perkiraan">
                  {TOPIK.map((t) => {
                    const b = perkiraan[t.kunci];
                    return b ? (
                      <li key={t.kunci}>
                        <strong>{t.nama}:</strong> {kalimatPerkiraan(t.awalanPerkiraan, b, t.desimal)}
                        {kalimatRentang(b.lo80, b.hi80, t.desimal) == null && ` ${TANPA_RENTANG}`}
                      </li>
                    ) : null;
                  })}
                </ul>
                <p className="label-angka label-perkiraan">
                  Perkiraan Con-Fore, bukan angka resmi. Dihitung {tanggal(dihitung)}.
                </p>
                <p className="arti">{ARTI_KEMUNGKINAN}</p>
                <details className="lipat">
                  <summary>Bagaimana perkiraan ini dihitung?</summary>
                  <p>
                    Perkiraan selalu berangkat dari angka resmi terakhir. Untuk setiap angka, beberapa cara hitung diuji
                    dengan data lama, dan yang paling jarang meleset menjadi angka utama.
                  </p>
                </details>
              </>
            ) : (
              <p>Perkiraan belum tersedia. Bagian ini terisi setelah pembaruan otomatis berikutnya berhasil.</p>
            )}
            <p className="tautan-rinci">
              <Link href="/indonesia/ke-depan">
                Lihat semua perkiraan dan seberapa sering meleset
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
