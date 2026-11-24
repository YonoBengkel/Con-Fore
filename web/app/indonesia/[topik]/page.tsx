// Halaman rinci Harga, Kerja, dan Ekonomi (PRD 4.1), dengan urutan isi yang sama: jawaban, perbandingan, grafik
// riwayat, rincian khusus, yang ikut memengaruhi, satu kalimat perkiraan, lalu penjelas, sumber, dan waktu data.
// Di layar lebar, jawaban bersebelahan dengan grafiknya, dan perkiraan dengan penjelasannya (DESIGN.md, Tata letak).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarisTanya, pertanyaanBerikutnya } from "@/components/BarisTanya";
import { Berikutnya } from "@/components/Berikutnya";
import { IsiJawaban } from "@/components/Jawaban";
import { KartuSeri, Sitasi } from "@/components/Kartu";
import { BannerBasi } from "@/components/Klien";
import { RincianInflasi, RincianPekerja } from "@/components/Rincian";
import { RiwayatInteraktif } from "@/components/RiwayatInteraktif";
import { titikSeri } from "@/lib/data";
import { tanggal, tanggalWIB } from "@/lib/format";
import {
  KELOMPOK_INFLASI,
  SERI_FORMAL,
  SERI_INFLASI_BULANAN,
  SERI_TPT_RONDE,
  TOPIK,
  keteranganJadwal,
  topikDari,
} from "@/lib/konten";
import { muatIndonesia } from "@/lib/muat";
import { penjelasSeri } from "@/lib/penjelas";
import { ARTI_KEMUNGKINAN, TANPA_RENTANG, kalimatPerkiraan, kalimatRentang } from "@/lib/prediksi";
import { barisRiwayat, judulTemuan, kalimatRiwayat } from "@/lib/riwayat";

// 6 jam; pipeline memanggil /api/revalidate setelah setiap publikasi.
export const revalidate = 21600;
export const dynamicParams = false;

type Props = { params: Promise<{ topik: string }> };

export function generateStaticParams() {
  return TOPIK.map((t) => ({ topik: t.kunci }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = topikDari((await params).topik);
  return t
    ? {
        title: t.tanya,
        description: `${t.tanya} Jawaban dari angka resmi terakhir, riwayatnya, yang ikut memengaruhinya, dan perkiraan Con-Fore.`,
      }
    : {};
}

/** Seri grafik tambahan untuk rincian khusus tiap pertanyaan. */
const RINCIAN: Record<string, string[]> = {
  harga: [SERI_INFLASI_BULANAN, ...KELOMPOK_INFLASI.flatMap((k) => [k.setahun, k.sebulan])],
  kerja: [SERI_FORMAL, SERI_TPT_RONDE],
  ekonomi: [],
};

export default async function HalamanRinci({ params }: Props) {
  const t = topikDari((await params).topik);
  if (!t) notFound();
  const { status, metaPer, nilaiPer, jadwal, grafik, jawaban, perkiraan } = await muatIndonesia([
    ...RINCIAN[t.kunci],
    ...t.penggerak,
  ]);
  const j = jawaban[t.kunci];
  const m = j?.meta;
  const n = j?.nilai;
  const titik = m ? titikSeri(grafik, m.series_id) : [];
  const penjelas = m ? penjelasSeri(m.series_id) : null;
  const simpulan = m ? kalimatRiwayat(titik, m.unit, m.concept, m.frequency) : null;
  const penggerak = t.penggerak.filter((s) => metaPer.has(s) && nilaiPer.has(s));
  const b = perkiraan[t.kunci];
  const lanjut = pertanyaanBerikutnya(t.kunci);
  const tanyaLanjut = TOPIK.find((x) => `/indonesia/${x.kunci}` === lanjut?.href)?.tanya ?? "Ke depan bagaimana?";

  return (
    <div data-topik={t.kunci}>
      <div className="kepala-halaman">
        <BarisTanya kini={t.kunci} />
        <div>
          <h1>{t.tanya}</h1>
          <p className="data-per">Angka per {tanggalWIB(status.last_success_at)}</p>
        </div>
      </div>
      <BannerBasi terakhir={status.last_success_at} />

      <div className="kisi-rinci">
        {j ? (
          <section className="blok" aria-label="Jawaban">
            <IsiJawaban j={j} />
          </section>
        ) : (
          <p>Angka ini belum tersedia. Halaman ini terisi setelah pembaruan otomatis berikutnya berhasil.</p>
        )}

        {m && (
          <section className="panel" aria-labelledby="judul-riwayat">
            <div className="panel-kepala">
              <h2 id="judul-riwayat" className="judul-grafik">
                {judulTemuan(titik, m.unit, m.concept) ?? "Riwayat"}
              </h2>
              <a href={`/api/csv/${m.series_id}`} download>
                Unduh riwayat (CSV)
              </a>
            </div>
            {titik.length < 2 ? (
              <p>Riwayat belum cukup untuk digambar.</p>
            ) : (
              <RiwayatInteraktif
                baris={barisRiwayat(titik, m.concept)}
                nama={m.name_id}
                satuan={m.unit}
                konsep={m.concept}
                frekuensi={m.frequency}
              />
            )}
          </section>
        )}
      </div>

      {t.kunci === "harga" && <RincianInflasi grafik={grafik} />}
      {t.kunci === "kerja" && <RincianPekerja grafik={grafik} />}

      {penggerak.length > 0 && (
        <section className="bagian" aria-labelledby="judul-penggerak">
          <h2 id="judul-penggerak">Yang ikut memengaruhi</h2>
          <div className="kisi-kartu kisi-penggerak">
            {penggerak.map((id) => (
              <KartuSeri
                key={id}
                tingkat="h3"
                meta={metaPer.get(id)!}
                nilai={nilaiPer.get(id)!}
                titik={titikSeri(grafik, id)}
                kalender={jadwal(id)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="dua-bagian dua-bagian-kotak">
        <section data-topik="ke-depan" aria-labelledby="judul-ke-depan">
          <h2 id="judul-ke-depan">Ke depan</h2>
          {b ? (
            <>
              <p className="rata-kiri">{kalimatPerkiraan(t.awalanPerkiraan, b, t.desimal)}</p>
              {kalimatRentang(b.lo80, b.hi80, t.desimal) == null && (
                <p className="catatan rata-kiri">{TANPA_RENTANG}</p>
              )}
              <p className="label-angka label-perkiraan">
                Perkiraan Con-Fore, bukan angka resmi. Dihitung {tanggal(b.origin_date)}.
              </p>
              <p className="arti">{ARTI_KEMUNGKINAN}</p>
            </>
          ) : (
            <p>Perkiraan belum tersedia. Bagian ini terisi setelah pembaruan otomatis berikutnya berhasil.</p>
          )}
          <p className="rata-kiri">
            <Link href={`/indonesia/ke-depan#perkiraan-${t.kartu}`}>
              Lihat perkiraan lengkap dan seberapa sering meleset
            </Link>
          </p>
        </section>

        {m && n && (
          <section aria-labelledby="judul-penjelas">
            <h2 id="judul-penjelas">Penjelasan dan sumber</h2>
            {penjelas && (
              <details className="lipat">
                <summary>{t.judulPenjelas}</summary>
                <h3>Apa yang diukur</h3>
                <p>{penjelas.ukur}</p>
                <h3>Cara dan sumber</h3>
                <p>{penjelas.cara}</p>
                <h3>Cara membacanya</h3>
                <p>{penjelas.baca}</p>
                {simpulan && (
                  <>
                    <h3>Yang bisa diambil</h3>
                    <p>{simpulan}</p>
                  </>
                )}
              </details>
            )}
            <dl className="rincian">
              <div>
                <dt>Sumber</dt>
                <dd>
                  <Sitasi teks={m.citation} />
                </dd>
              </div>
              {n.release_date && (
                <div>
                  <dt>Dirilis</dt>
                  <dd>{tanggal(n.release_date)}</dd>
                </div>
              )}
              <div>
                <dt>Dilihat Con-Fore</dt>
                <dd>{tanggal(n.seen_date)}</dd>
              </div>
              {m.next_release_date && (
                <div>
                  <dt>Rilis berikutnya</dt>
                  <dd>
                    {tanggal(m.next_release_date)}, {keteranganJadwal(m, jadwal(m.series_id))}
                  </dd>
                </div>
              )}
            </dl>
            <p className="rata-kiri">
              <Link href={`/indikator/${m.series_id}`}>Data lengkap angka ini dan unduhan CSV</Link>
            </p>
          </section>
        )}
      </div>

      {lanjut && (
        <Berikutnya tautan={[{ href: lanjut.href, tanya: tanyaLanjut, teks: `Lanjut ke ${lanjut.nama}` }]} />
      )}
    </div>
  );
}
