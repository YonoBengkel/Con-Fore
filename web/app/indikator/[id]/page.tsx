// Detail per seri: riwayat panjang, nilai terakhir, jadwal rilis berikutnya, dan unduhan CSV.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GrafikKelompok, GrafikRiwayat, GrafikRonde } from "@/components/Grafik";
import { Lencana, Sitasi, TabelTarget } from "@/components/Kartu";
import { BannerBasi } from "@/components/Klien";
import {
  POLA_ID,
  bacaGrafik,
  bacaKalender,
  bacaMeta,
  bacaNilai,
  bacaStatus,
  bacaTarget,
  titikSeri,
} from "@/lib/data";
import { angka, nilaiSeri, perubahan, periode, tanggal, waktuWIB } from "@/lib/format";
import {
  KELOMPOK_INFLASI,
  NAMA_KALENDER,
  SERI_DITAUTKAN,
  SERI_FORMAL,
  SERI_INFLASI_BULANAN,
  SERI_KARTU,
  SERI_TPT_RONDE,
  artinyaBuatmu,
  labelSeri,
} from "@/lib/konten";
import { kalimatPekerja } from "@/lib/pekerja";
import { rincianInflasi } from "@/lib/rincian";

const SERI_RINCIAN = [
  SERI_KARTU.inflasi[0],
  SERI_INFLASI_BULANAN,
  ...KELOMPOK_INFLASI.flatMap((k) => [k.setahun, k.sebulan]),
];

// 6 jam; pipeline memanggil /api/revalidate setelah setiap publikasi.
export const revalidate = 21600;

// Hanya id yang dibangun saat build: id lain langsung 404 tanpa render, supaya alamat karangan
// tidak menulis cache ISR satu per satu (batas paket Hobby, ARCHITECTURE 4.5). Seri baru di luar
// SERI_DITAUTKAN mendapat halaman setelah build web berikutnya.
export const dynamicParams = false;

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  const meta = await bacaMeta();
  return [...new Set([...meta.map((m) => m.series_id), ...SERI_DITAUTKAN])].map((id) => ({ id }));
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
  const halamanTpt = SERI_KARTU.pengangguran.includes(id);
  const halamanInflasi = SERI_KARTU.inflasi.includes(id);
  const [meta, nilai, status, grafik, kalender, target] = await Promise.all([
    bacaMeta(),
    bacaNilai(),
    bacaStatus(),
    bacaGrafik([
      id,
      ...(halamanTpt ? [SERI_FORMAL, SERI_TPT_RONDE] : []),
      ...(halamanInflasi ? SERI_RINCIAN : []),
    ]),
    bacaKalender(),
    bacaTarget(),
  ]);
  const m = meta.find((x) => x.series_id === id);
  if (!m) notFound();
  const n = nilai.find((x) => x.series_id === id);
  const titik = titikSeri(grafik, id);
  const rilis = kalender.filter((r) => r.series_id === id);
  const targetSeri = target.filter((t) => t.series_id === id);
  const artinya = n ? artinyaBuatmu(id, n.value) : null;
  const terbaru = titik.slice(-12).reverse();
  const formal = halamanTpt ? titikSeri(grafik, SERI_FORMAL) : [];
  const pekerja = kalimatPekerja(formal, halamanTpt ? titikSeri(grafik, SERI_TPT_RONDE) : []);
  const rincian = halamanInflasi ? rincianInflasi((s) => titikSeri(grafik, s)) : null;

  return (
    <>
      <p className="pembuka">
        <Link href="/">Kembali ke Data</Link>
      </p>
      <h1>{m.name_id}</h1>
      <BannerBasi terakhir={status.last_success_at} />

      {n ? (
        <section className="panel" aria-labelledby="judul-terakhir">
          <h2 id="judul-terakhir" className="sr-only">
            Angka terakhir
          </h2>
          <p className="kartu-angka">{nilaiSeri(n.value, m.unit, m.concept)}</p>
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
        <p>Angka terakhir belum tersedia.</p>
      )}

      <section aria-labelledby="judul-riwayat">
        <h2 id="judul-riwayat">Riwayat</h2>
        <div className="panel">
          {id === SERI_FORMAL ? (
            <GrafikRonde titik={titik} nama={m.name_id} />
          ) : (
            <GrafikRiwayat titik={titik} nama={m.name_id} konsep={m.concept} />
          )}
        </div>
      </section>

      {pekerja && (
        <section aria-labelledby="judul-pekerja">
          <h2 id="judul-pekerja">Pekerja formal dan informal</h2>
          <div className="panel">
            <p>
              {pekerja.porsi} {pekerja.hubungan}
            </p>
            <GrafikRonde titik={formal} nama="porsi pekerja formal" />
            <p className="catatan">
              Pekerja formal menurut BPS adalah yang berusaha dibantu buruh tetap dan dibayar, serta
              buruh, karyawan, atau pegawai. Selebihnya informal. Garisnya dipisah per bulan survei,
              karena porsinya berbeda antara Februari dan Agustus. Lihat{" "}
              <Link href="/cara-kerja#pekerja-formal">Cara kerja</Link>.
            </p>
            <div className="gulir-tabel" role="region" aria-labelledby="judul-pekerja" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Ronde</th>
                    <th scope="col">Formal</th>
                    <th scope="col">Informal</th>
                  </tr>
                </thead>
                <tbody>
                  {formal.slice(-6).reverse().map(([p, v]) => (
                    <tr key={p}>
                      <th scope="row">{periode(p)}</th>
                      <td className="angka">{angka(v, 2)}%</td>
                      <td className="angka">{angka(100 - v, 2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <Link href={`/indikator/${SERI_FORMAL}`}>Riwayat lengkap porsi pekerja formal</Link>
            </p>
          </div>
        </section>
      )}

      {rincian && (
        <section aria-labelledby="judul-rincian">
          <h2 id="judul-rincian">Rincian inflasi</h2>
          <div className="panel">
            <p>{rincian.kalimat}</p>
            <div className="gulir-tabel" role="region" aria-labelledby="judul-rincian" tabIndex={0}>
              <table className="kepala-bungkus">
                <thead>
                  <tr>
                    <th scope="col">Kelompok</th>
                    <th scope="col">Dibanding setahun lalu</th>
                    <th scope="col">Dibanding bulan lalu</th>
                  </tr>
                </thead>
                <tbody>
                  {rincian.baris.map((b) => (
                    <tr key={b.nama}>
                      <th scope="row">{b.nama}</th>
                      <td className="angka">{b.setahun == null ? "-" : nilaiSeri(b.setahun, "%", "yoy")}</td>
                      <td className="angka">{b.sebulan == null ? "-" : nilaiSeri(b.sebulan, "%", "rate")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul>
              {KELOMPOK_INFLASI.map((k) => (
                <li key={k.setahun}>
                  <strong>{k.nama}:</strong> {k.isi}{" "}
                  <Link href={`/indikator/${k.setahun}`}>Riwayat {k.nama.toLowerCase()}</Link>
                </li>
              ))}
            </ul>
            <h3>Dibanding bulan yang sama tahun sebelumnya</h3>
            <GrafikKelompok
              kelompok={KELOMPOK_INFLASI.map((k) => ({ nama: k.nama, titik: titikSeri(grafik, k.setahun) }))}
            />
            <p className="catatan">
              Skala ketiga grafik sama. Lonjakan harga diatur pemerintah pada awal 2026 dan penurunannya
              pada awal 2025 berkaitan dengan diskon tarif listrik 50 persen pada awal 2025, menurut BPS.
            </p>
            <p className="catatan">
              Angka kelompok tidak bisa dijumlahkan menjadi angka umum, karena bobot tiap kelompok berbeda.
              Angka dibanding bulan lalu dan angka umum adalah data resmi BPS. Angka setahun per kelompok
              dihitung Con-Fore dari 12 perubahan bulanan, jadi bisa berbeda sekitar 0,02 poin persen dari
              angka rilis BPS. Lihat <Link href="/cara-kerja#rincian-inflasi">Cara kerja</Link>.
            </p>
          </div>
        </section>
      )}

      <div className="dua-kolom">
        <section aria-labelledby="judul-tabel">
          <h2 id="judul-tabel">Angka terbaru</h2>
          <div className="gulir-tabel" role="region" aria-labelledby="judul-tabel" tabIndex={0}>
            <table>
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
                    <td className="angka">{nilaiSeri(v, m.unit, m.concept)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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
          <h3>Jadwal rilis berikutnya</h3>
          {rilis.length ? (
            <ul>
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
            <p className="catatan">
              Salinan IMF biasanya terbit beberapa minggu setelah BPS merilis angkanya, jadi angka di
              sini bisa tertinggal dari berita hari rilis.
            </p>
          )}
          <p>
            <a href={`/api/csv/${m.series_id}`} download>
              Unduh seluruh riwayat (CSV)
            </a>
          </p>
        </section>
      </div>

      {targetSeri.length > 0 && (
        <section aria-labelledby="judul-target-seri">
          <h2 id="judul-target-seri">Target resmi untuk angka ini</h2>
          <TabelTarget target={targetSeri} judul={`Target resmi: ${m.name_id}`} />
        </section>
      )}
    </>
  );
}
