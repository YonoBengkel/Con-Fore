// Halaman Banding (PRD 4.1): proyeksi IMF untuk Indonesia dan satu negara pilihan pengunjung, berdampingan per tahun.
// Con-Fore hanya meramal Indonesia, jadi perkiraannya menjadi baris berlabel di tahun yang belum terbit. Satu halaman
// per negara, dan /banding dialihkan ke negara pertama (next.config.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { Berikutnya } from "@/components/Berikutnya";
import { GrafikBanding } from "@/components/Grafik";
import { Sitasi } from "@/components/Kartu";
import { BannerBasi } from "@/components/Klien";
import {
  AWALAN_INDONESIA,
  DESIMAL,
  ISI_BANDING,
  NEGARA_BANDING,
  barisBanding,
  daftarDefinisi,
  kalimatBanding,
  kalimatDefinisi,
  labelTerbit,
  negaraDari,
  seriProyeksi,
  terbitProyeksi,
  type BarisBanding,
  type Negara,
} from "@/lib/banding";
import { bacaGrafik, bacaMetaSeri, bacaNilai, bacaRamalan, bacaStatus, titikSeri } from "@/lib/data";
import { tanggal } from "@/lib/format";
import { terbaru } from "@/lib/jsonld";
import { TOPIK, type Topik } from "@/lib/konten";
import { TARGET_PREDIKSI, jalurUtama, nilaiPerTahun, persen } from "@/lib/prediksi";

// 6 jam; pipeline memanggil /api/revalidate setelah setiap publikasi.
export const revalidate = 21600;
export const dynamicParams = false;

type Props = { params: Promise<{ negara: string }> };

export function generateStaticParams() {
  return NEGARA_BANDING.map((n) => ({ negara: n.kunci }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = negaraDari((await params).negara);
  return n
    ? {
        title: `Indonesia dan ${n.nama}`,
        description: `Proyeksi IMF untuk inflasi, pengangguran, dan pertumbuhan ekonomi Indonesia dan ${n.nama}, berdampingan per tahun, dengan perkiraan Con-Fore untuk Indonesia.`,
      }
    : {};
}

function PilihNegara({ kini }: { kini: string }) {
  return (
    <nav className="baris-tanya pilih-negara" aria-label="Negara pembanding">
      {NEGARA_BANDING.map((n) => (
        <Link key={n.kunci} href={`/banding/${n.kunci}`} aria-current={kini === n.kunci ? "page" : undefined}>
          {n.nama}
        </Link>
      ))}
    </nav>
  );
}

/** Contoh garis di kepala tabel, jadi tabel di bawah grafik sekaligus menjadi legendanya. */
function ContohGaris({ lain = false }: { lain?: boolean }) {
  return (
    <svg className="contoh-garis" viewBox="0 0 27 6" aria-hidden="true" focusable="false">
      <path d="M0 3H27" className={lain ? "garis garis-putus garis-lain" : "garis garis-putus"} />
    </svg>
  );
}

function TabelBanding({ baris, negara, nama }: { baris: BarisBanding[]; negara: string; nama: string }) {
  const adaConFore = baris.some((b) => b.conFore != null);
  return (
    <div className="gulir-tabel" role="region" aria-label={`${nama}, Indonesia dan ${negara}`} tabIndex={0}>
      <table className="tabel-banding">
        <caption className="sr-only">
          Proyeksi IMF per tahun: {nama}, Indonesia dan {negara}
          {adaConFore && ", dengan perkiraan Con-Fore untuk Indonesia"}
        </caption>
        <thead>
          <tr>
            <th scope="col">Tahun</th>
            <th scope="col">
              <ContohGaris />
              Indonesia
            </th>
            <th scope="col">
              <ContohGaris lain />
              {negara}
            </th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <Fragment key={b.tahun}>
              <tr>
                <th scope="row">{b.tahun}</th>
                <td className="angka">{persen(b.indonesia, DESIMAL)}</td>
                <td className="angka">{persen(b.lain, DESIMAL)}</td>
              </tr>
              {b.conFore != null && (
                <tr className="baris-con-fore">
                  <th scope="row">
                    <span className="lencana lencana-perkiraan">
                      Perkiraan <span className="utuh">Con-Fore</span>
                    </span>
                    <span className="sr-only"> untuk {b.tahun}</span>
                  </th>
                  <td className="angka">{persen(b.conFore, DESIMAL)}</td>
                  <td>
                    <span aria-hidden="true">-</span>
                    <span className="sr-only">tidak diramal Con-Fore</span>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DefinisiPenganggur({ negara }: { negara: Negara }) {
  return (
    <>
      <p className="catatan rata-kiri">{kalimatDefinisi(negara)}</p>
      <details className="rincian-kartu">
        <summary>Siapa yang dihitung menganggur</summary>
        <div className="lipat-isi">
          {daftarDefinisi(negara).map((d) => (
            <Fragment key={d.nama}>
              <p>
                <strong>{d.nama}:</strong> {d.isi}
              </p>
              <p className="catatan sitasi">
                Sumber: <a href={d.url}>{d.sumber}</a>
              </p>
            </Fragment>
          ))}
        </div>
      </details>
    </>
  );
}

function KartuBanding({
  topik,
  negara,
  baris,
  label,
  basi,
  sitasi,
  dihitung,
}: {
  topik: Topik;
  negara: Negara;
  baris: BarisBanding[];
  label: string;
  basi: boolean;
  sitasi?: string;
  dihitung?: string;
}) {
  const isi = ISI_BANDING[topik.kunci];
  const adaConFore = baris.some((b) => b.conFore != null);
  const adaMinus = baris.some((b) => [b.indonesia, b.lain, b.conFore].some((n) => n != null && n < 0));
  // Tujuh anak langsung: di layar lebar ketiga kartu berbagi baris yang sama (.kisi-banding di globals.css).
  return (
    <article className="kartu kartu-utama" data-topik={topik.kunci}>
      <h2 className="kartu-judul">{topik.nama}</h2>
      <p className="kartu-nama">{isi.nama}</p>
      {baris.length === 0 ? (
        <p>Proyeksi IMF untuk angka ini belum tersedia.</p>
      ) : (
        <>
          <p className="prediksi-kalimat">{kalimatBanding(isi.subjek, negara.nama, baris)}</p>
          <GrafikBanding baris={baris} negara={negara.nama} nama={isi.nama} />
          <p className="label-angka label-perkiraan">
            {label}
            {basi && <span className="label-basi">. Terlambat diperbarui.</span>}
          </p>
          <TabelBanding baris={baris} negara={negara.nama} nama={isi.nama} />
          <div className="banding-catatan">
            {sitasi && (
              <p className="catatan sitasi">
                Sumber: <Sitasi teks={sitasi} />
              </p>
            )}
            {adaMinus && isi.minus && <p className="catatan rata-kiri">{isi.minus}</p>}
            <p className="catatan rata-kiri">
              {adaConFore && dihitung ? `${isi.conFore}. Dihitung ${tanggal(dihitung)}.` : isi.tanpaConFore}
            </p>
            {topik.kunci === "kerja" && <DefinisiPenganggur negara={negara} />}
          </div>
        </>
      )}
    </article>
  );
}

export default async function Banding({ params }: Props) {
  const negara = negaraDari((await params).negara);
  if (!negara) notFound();
  const seriPasangan = (t: Topik) => ({
    indonesia: seriProyeksi(t.kartu, AWALAN_INDONESIA),
    lain: seriProyeksi(t.kartu, negara.awalan),
  });
  const seriImf = TOPIK.flatMap((t) => Object.values(seriPasangan(t)));
  const [ramalan, status, meta, nilai, grafik] = await Promise.all([
    bacaRamalan(),
    bacaStatus(),
    bacaMetaSeri(seriImf),
    bacaNilai(),
    bacaGrafik([...seriImf, ...TARGET_PREDIKSI.map((t) => t.seri)], true),
  ]);

  const basi = new Set(nilai.filter((n) => n.is_stale).map((n) => n.series_id));
  const terbit = terbitProyeksi(meta, basi);
  const perTahun = nilaiPerTahun(ramalan, (seri) => titikSeri(grafik, seri));
  const kartu = TOPIK.map((topik) => {
    const { indonesia, lain } = seriPasangan(topik);
    const [tglIndonesia, tglLain] = [terbit.get(indonesia), terbit.get(lain)];
    const mulai = Number(terbaru([tglIndonesia, tglLain])?.slice(0, 4));
    return {
      topik,
      baris:
        tglIndonesia && tglLain
          ? barisBanding(titikSeri(grafik, indonesia), titikSeri(grafik, lain), mulai, topik.kartu, perTahun)
          : [],
      label: tglIndonesia && tglLain ? labelTerbit(negara.nama, tglIndonesia, tglLain) : "",
      basi: basi.has(indonesia) || basi.has(lain),
      sitasi: meta.find((m) => m.series_id === lain)?.citation,
      dihitung: jalurUtama(ramalan, TARGET_PREDIKSI.find((t) => t.kunci === topik.kartu)!.seri)[0]?.origin_date,
    };
  });
  const isi = kartu.filter((k) => k.baris.length > 0);
  const label = [...new Set(isi.map((k) => k.label))];

  return (
    <>
      <div className="kepala-halaman">
        <div>
          <h1>Indonesia dan {negara.nama}</h1>
          {label.length === 1 && <p className="data-per">{label[0]}</p>}
        </div>
        <PilihNegara kini={negara.kunci} />
      </div>
      <BannerBasi terakhir={status.last_success_at} />
      {isi.length > 0 ? (
        <>
          <p className="pengantar">
            Semua angka di sini tanpa rentang, karena IMF tidak menerbitkannya. Rentang dan seberapa sering perkiraan{" "}
            <span className="utuh">Con-Fore</span> meleset ada di{" "}
            <Link href="/indonesia/ke-depan">Ke&nbsp;depan</Link>.
          </p>
          <div className="kisi-kartu kisi-utama kisi-banding">
            {kartu.map((k) => (
              <KartuBanding key={k.topik.kunci} negara={negara} {...k} />
            ))}
          </div>
        </>
      ) : (
        <p>
          Proyeksi IMF belum tersedia. Halaman ini terisi setelah pembaruan otomatis berikutnya berhasil. Sementara
          itu, angka resmi terakhir ada di halaman <Link href="/indonesia">Indonesia</Link>.
        </p>
      )}
      <Berikutnya
        tautan={[
          {
            href: "/indonesia/ke-depan",
            tanya: "Ke depan bagaimana?",
            teks: "Lihat perkiraan Con-Fore untuk Indonesia dengan rentangnya",
          },
        ]}
      />
    </>
  );
}
