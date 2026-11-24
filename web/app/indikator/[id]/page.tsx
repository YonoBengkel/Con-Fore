// Halaman data per seri (PRD 4.1): riwayat panjang, nilai terakhir, jadwal rilis, target, dan unduhan CSV.
// Ditautkan dari halaman rinci; rincian kelompok harga dan pekerja formal ada di halaman rinci Harga dan Kerja.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Berikutnya, type TautanBerikutnya } from "@/components/Berikutnya";
import { GrafikRonde } from "@/components/Grafik";
import { JsonLd } from "@/components/JsonLd";
import { Lencana, Sitasi, TabelTarget } from "@/components/Kartu";
import { BannerBasi } from "@/components/Klien";
import { RiwayatInteraktif } from "@/components/RiwayatInteraktif";
import {
  POLA_ID,
  bacaGrafik,
  bacaKalender,
  bacaMeta,
  bacaNilai,
  bacaRevisi,
  bacaStatus,
  bacaSumber,
  bacaTarget,
  titikSeri,
} from "@/lib/data";
import { nilaiPendek, perubahan, periode, tanggal, waktuWIB } from "@/lib/format";
import { jsonLdSeri } from "@/lib/jsonld";
import {
  NAMA_FREKUENSI,
  NAMA_KALENDER,
  SERI_DITAUTKAN,
  SERI_FORMAL,
  SERI_KARTU,
  adalahProyeksi,
  artinyaBuatmu,
  kelompokHalaman,
  labelSeri,
  topikSeri,
} from "@/lib/konten";
import { penjelasSeri } from "@/lib/penjelas";
import { barisRiwayat, judulTemuan, kalimatRiwayat } from "@/lib/riwayat";

// 6 jam; pipeline memanggil /api/revalidate setelah setiap publikasi.
export const revalidate = 21600;

// Hanya id yang dibangun saat build: id lain langsung 404 tanpa render, supaya alamat karangan
// tidak menulis cache ISR satu per satu (batas paket Hobby, ARCHITECTURE 4.5). Seri baru di luar
// SERI_DITAUTKAN mendapat halaman setelah build web berikutnya. Seri proyeksi IMF tidak punya halaman,
// karena "angka terakhir"-nya tahun yang belum terjadi, dan tab Data tidak memuat ramalan.
export const dynamicParams = false;

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  const meta = await bacaMeta();
  const seri = meta.map((m) => m.series_id).filter((id) => !adalahProyeksi(id));
  return [...new Set([...seri, ...SERI_DITAUTKAN])].map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!POLA_ID.test(id)) return {};
  const m = (await bacaMeta()).find((x) => x.series_id === id);
  return m ? { title: m.name_id, description: `Riwayat ${m.name_id} beserta sumber dan jadwal rilisnya.` } : {};
}

export default async function Indikator({ params }: Props) {
  const { id } = await params;
  if (!POLA_ID.test(id)) notFound();
  const [meta, nilai, status, grafik, kalender, target, sumber, revisi] = await Promise.all([
    bacaMeta(),
    bacaNilai(),
    bacaStatus(),
    bacaGrafik([id]),
    bacaKalender(),
    bacaTarget(),
    bacaSumber(),
    bacaRevisi(id),
  ]);
  const m = meta.find((x) => x.series_id === id);
  if (!m) notFound();
  const n = nilai.find((x) => x.series_id === id);
  const titik = titikSeri(grafik, id);
  const rilis = kalender.filter((r) => r.series_id === id);
  const targetSeri = target.filter((t) => t.series_id === id);
  const artinya = n ? artinyaBuatmu(id, n.value, n.previous_value) : null;
  const terbaru = titik.slice(-12).reverse();
  const olahan = labelSeri(m).startsWith("dihitung");
  // Revisi per tanggal, supaya tanggalnya tidak diulang di setiap baris dan tabelnya muat di layar HP.
  const kelompokRevisi = [
    ...Map.groupBy(revisi, (r) =>
      r.release_date ? `Dirilis ${tanggal(r.release_date)}` : `Dilihat Con-Fore ${tanggal(r.vintage_date)}`,
    ),
  ];
  // Pertanyaan pemilik seri ini, untuk remah dan tautan balik; tiga angka utama juga punya perkiraan di Ke depan.
  const topik = topikSeri(id);
  const angkaUtama = topik != null && SERI_KARTU[topik.kartu].includes(id);
  const berikutnya: TautanBerikutnya[] = [
    topik
      ? { href: `/indonesia/${topik.kunci}`, tanya: topik.tanya, teks: `Kembali ke ${topik.nama}` }
      : { href: "/indonesia", tanya: "Kembali ke ringkasan?", teks: "Lihat keempat jawaban di halaman Indonesia" },
    ...(angkaUtama
      ? [
          {
            href: `/indonesia/ke-depan#perkiraan-${topik.kartu}`,
            tanya: "Ke depan bagaimana?",
            teks: "Lihat perkiraannya di Ke depan",
          },
        ]
      : []),
  ];

  const kelompok = kelompokHalaman(id);
  const saudara = kelompok?.seri.filter(([s]) => meta.some((x) => x.series_id === s)) ?? [];
  const penjelas = penjelasSeri(id);
  const simpulan = kalimatRiwayat(titik, m.unit, m.concept, m.frequency);
  const satuanPanjang = m.unit.startsWith("%") ? m.unit.replace(/^%\s*/, "") : m.unit;
  const rentang = titik.length ? `${periode(titik[0][0])} sampai ${periode(titik[titik.length - 1][0])}` : null;
  // Judul grafik berupa kalimat temuan (PRD 4.4). Satuannya ikut baris keterangan di bawah judul halaman,
  // tanpa anak judul yang mengulang nama seri dan rentang waktu.
  const judulGrafik = judulTemuan(titik, m.unit, m.concept);
  const satuanSudahDisebut = m.name_id.toLowerCase().includes(m.unit.toLowerCase());
  const satuanMeta = satuanSudahDisebut ? null : m.unit.replace(/^%/, "persen");

  return (
    <div data-topik={topik?.kunci}>
      <JsonLd data={jsonLdSeri(m, titik, n, sumber.find((s) => s.source_id === m.source_id))} />
      <nav aria-label="Letak halaman" className="remah">
        <ol>
          <li>
            <Link href="/indonesia">Indonesia</Link>
          </li>
          {topik && (
            <li>
              <Link href={`/indonesia/${topik.kunci}`}>{topik.nama}</Link>
            </li>
          )}
          {kelompok && <li>{kelompok.judul}</li>}
        </ol>
      </nav>
      <h1>{m.name_id}</h1>
      <p className="meta-seri">
        {[NAMA_FREKUENSI[m.concept === "round_rate" ? "ronde" : m.frequency], satuanMeta, rentang, labelSeri(m)]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="baris-penjelas">
        {penjelas && (
          <details className="penjelas">
            <summary>Baru kenal angka ini? Mulai dari penjelasan singkatnya.</summary>
            <div className="penjelas-isi">
              <div>
                <h2>Apa yang diukur</h2>
                <p>{penjelas.ukur}</p>
              </div>
              <div>
                <h2>Cara dan sumber</h2>
                <p>{penjelas.cara}</p>
              </div>
              <div>
                <h2>Cara membacanya</h2>
                <p>{penjelas.baca}</p>
              </div>
              {simpulan && (
                <div>
                  <h2>Yang bisa diambil</h2>
                  <p>{simpulan}</p>
                </div>
              )}
            </div>
          </details>
        )}
        {saudara.length > 1 && (
          <nav aria-label={kelompok?.judul} className="pil-baris">
            {saudara.map(([s, nama]) => (
              <Link key={s} href={`/indikator/${s}`} aria-current={s === id ? "page" : undefined}>
                {nama}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <BannerBasi terakhir={status.last_success_at} />

      <div className="kisi-detail">
        {n ? (
          <section className="panel detail-angka" aria-labelledby="judul-terakhir">
            <h2 id="judul-terakhir" className="alis">
              Angka terakhir
            </h2>
            <p className="kartu-angka">
              <data value={n.value}>{nilaiPendek(n.value, m.unit, m.concept)}</data>
              {satuanPanjang && <span className="kartu-satuan"> {satuanPanjang}</span>}
            </p>
            <p className="kartu-periode">
              {periode(n.period)}
              {(() => {
                const u = perubahan(n.value, n.previous_value, m.unit, m.concept, m.frequency);
                return u ? <span className="kartu-ubah">, {u}</span> : null;
              })()}
            </p>
            <Lencana meta={m} basi={n.is_stale} />
            {artinya && (
              <p className="artinya">
                <strong>Artinya buatmu:</strong> {artinya}
              </p>
            )}
          </section>
        ) : (
          <p className="detail-angka">Angka terakhir belum tersedia.</p>
        )}

        <section className="panel detail-grafik" aria-labelledby="judul-riwayat">
          <div className="panel-kepala">
            <h2 id="judul-riwayat" className="judul-grafik">
              {judulGrafik ?? "Riwayat"}
            </h2>
            <a href={`/api/csv/${m.series_id}`} download>
              Unduh seluruh riwayat (CSV)
            </a>
          </div>
          {id === SERI_FORMAL ? (
            <GrafikRonde titik={titik} nama={m.name_id} />
          ) : titik.length < 2 ? (
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

        <section className="detail-tabel" aria-labelledby="judul-tabel">
          <div className="gulir-tabel" role="region" aria-labelledby="judul-tabel" tabIndex={0}>
            <table>
              <caption id="judul-tabel">Angka terbaru</caption>
              <thead>
                <tr>
                  <th scope="col">Periode</th>
                  <th scope="col">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {terbaru.map(([p, v]) => (
                  <tr key={p}>
                    <th scope="row">{periode(p)}</th>
                    <td className="angka">{nilaiPendek(v, m.unit, m.concept)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="detail-lain">
          {topik && !angkaUtama && (
            <p className="tautan-rinci">
              Angka ini dibahas di halaman <Link href={`/indonesia/${topik.kunci}`}>{topik.tanya}</Link>
            </p>
          )}

          <div className="dua-bagian">
            <section aria-labelledby="judul-tentang">
              <h2 id="judul-tentang">Tentang angka ini</h2>
              <dl className="rincian">
                <div>
                  <dt>Label</dt>
                  <dd>{labelSeri(m)}</dd>
                </div>
                <div>
                  <dt>Satuan</dt>
                  <dd>{m.unit}</dd>
                </div>
                <div>
                  <dt>Sumber</dt>
                  <dd>
                    <Sitasi teks={m.citation} />
                  </dd>
                </div>
                {n?.release_date && (
                  <div>
                    <dt>Tanggal rilis</dt>
                    <dd>{tanggal(n.release_date)}</dd>
                  </div>
                )}
                <div>
                  <dt>Dilihat Con-Fore</dt>
                  <dd>{tanggal(n?.seen_date ?? null)}</dd>
                </div>
                <div>
                  <dt>Pembaruan otomatis terakhir</dt>
                  <dd>{waktuWIB(status.last_success_at)}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="judul-jadwal">
              <h2 id="judul-jadwal">Jadwal rilis berikutnya</h2>
              {rilis.length ? (
                <ul className="rata-kiri">
                  {rilis.map((r) => (
                    <li key={r.ref_period}>
                      Data {periode(r.ref_period)}: {tanggal(r.release_date)} (
                      {NAMA_KALENDER[r.calendar_source] ?? r.calendar_source})
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Belum ada jadwal rilis yang tercatat untuk angka ini.</p>
              )}
              {m.source_id === "imf" && m.country === "IDN" && (
                <p className="catatan rata-kiri">
                  Salinan IMF biasanya terbit beberapa minggu setelah BPS merilis angkanya, jadi angka di
                  sini bisa tertinggal dari berita hari rilis.
                </p>
              )}
            </section>
          </div>

          {/* Catatan revisi (PRD 4.4): hanya bila angka tampil berubah, dengan sejak kapan setiap versi disimpan. */}
          {(revisi.length > 0 || m.versions_since || olahan) && (
            <section className="bagian" aria-labelledby="judul-revisi">
              <h2 id="judul-revisi">Catatan revisi</h2>
              {revisi.length > 0 ? (
                <div className="gulir-tabel" role="region" aria-labelledby="judul-revisi" tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Periode</th>
                        <th scope="col">Angka lama</th>
                        <th scope="col">Angka baru</th>
                      </tr>
                    </thead>
                    {kelompokRevisi.map(([waktu, baris]) => (
                      <tbody key={waktu}>
                        <tr>
                          <th scope="rowgroup" colSpan={3} className="kepala-kelompok">
                            {waktu}
                          </th>
                        </tr>
                        {baris.map((r) => (
                          <tr key={`${r.period}-${r.vintage_date}`}>
                            <th scope="row">{periode(r.period)}</th>
                            <td className="angka">{nilaiPendek(r.old_value, m.unit, m.concept)}</td>
                            <td className="angka">{nilaiPendek(r.new_value, m.unit, m.concept)}</td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                </div>
              ) : (
                m.versions_since && <p>Belum ada revisi yang mengubah angka yang tampil.</p>
              )}
              <p className="catatan">
                {m.versions_since
                  ? `Con-Fore menyimpan setiap versi angka ini sejak ${tanggal(m.versions_since)}. Revisi sebelum tanggal itu tidak terekam.`
                  : "Angka ini dihitung Con-Fore dari seri lain, jadi revisinya mengikuti revisi seri asalnya."}
              </p>
            </section>
          )}
        </div>
      </div>

      {targetSeri.length > 0 && (
        <section className="bagian" aria-labelledby="judul-target-seri">
          <h2 id="judul-target-seri">Target resmi untuk angka ini</h2>
          <TabelTarget target={targetSeri} judul={`Target resmi: ${m.name_id}`} />
        </section>
      )}

      <Berikutnya tautan={berikutnya} />
    </div>
  );
}
