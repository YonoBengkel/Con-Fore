// Halaman Ke depan (PRD 4.1): perkiraan ketiga angka dengan rentang dalam kata dan grafik kipas, seberapa sering
// meleset, pembanding proyeksi IMF, dan target jangka panjang. Semua angka berlabel perkiraan dan berangkat dari
// angka resmi terakhir. Pengganti tab Prediksi; /prediksi dialihkan ke sini.

import type { Metadata } from "next";
import Link from "next/link";
import { BarisTanya } from "@/components/BarisTanya";
import { Berikutnya } from "@/components/Berikutnya";
import { GrafikJangkaPanjang, GrafikPerkiraan } from "@/components/Grafik";
import { JsonLd } from "@/components/JsonLd";
import { Sitasi } from "@/components/Kartu";
import { BannerBasi } from "@/components/Klien";
import {
  bacaGrafik,
  bacaMeta,
  bacaRamalan,
  bacaRekamJejak,
  bacaSkorBacktest,
  bacaStatus,
  bacaTarget,
  titikSeri,
  type BarisRamalan,
  type SkorBacktest,
  type Titik,
} from "@/lib/data";
import { angka, periode, tanggal } from "@/lib/format";
import { jsonLdPerkiraan } from "@/lib/jsonld";
import { TOPIK, type Topik } from "@/lib/konten";
import {
  ARTI_KEMUNGKINAN,
  NAMA_MODEL,
  SERI_BULANAN,
  SERI_PDB_TAHUNAN,
  TANPA_RENTANG,
  TARGET_PREDIKSI,
  artinyaPerkiraan,
  barisJangkaPanjang,
  cakupanRentang,
  jalurUtama,
  kalimatCakupan,
  kalimatCara,
  kalimatEfekBasis,
  kalimatJangkaPanjang,
  kalimatPerkiraan,
  kalimatRentang,
  nilaiTahunPerkiraan,
  persen,
  tahunPerkiraan,
  type NilaiTahun,
  type TargetPrediksi,
} from "@/lib/prediksi";

export const metadata: Metadata = {
  title: "Ke depan bagaimana?",
  description:
    "Perkiraan harga, pengangguran, dan pertumbuhan ekonomi Indonesia, lengkap dengan rentang, pembanding proyeksi IMF, dan catatan seberapa sering perkiraan itu meleset.",
};

// 6 jam; pipeline memanggil /api/revalidate setelah ramalan baru terbit.
export const revalidate = 21600;

/** Kotak lipat di setiap kartu yang hanya menyebut penggerak yang terbukti pada uji data lama (PRD 4.1). */
const UJI_PENGGERAK: Record<string, string> = {
  pertumbuhan:
    "Ekspor, impor, produksi industri, wisatawan, uang beredar, dan harga komoditas sudah diuji, dan tidak ada yang membuat perkiraan lebih akurat. Angka PDB memang sangat stabil di luar masa COVID.",
  inflasi:
    "Kurs, harga minyak, dan BI-Rate sudah diuji dan tidak menurunkan galat, jadi tidak dipakai. Kebijakan baru, misalnya perubahan harga BBM atau tarif listrik, belum masuk perkiraan ini.",
  pengangguran:
    "Pertumbuhan PDB sudah diuji dan tidak membuat perkiraan lebih akurat. Sampelnya masih kecil, jadi perkiraan ini eksperimental.",
};

function KartuPerkiraan({
  topik,
  target,
  jalur,
  semua,
  riwayat,
  skor,
  bulanan,
  sitasi,
}: {
  topik: Topik;
  target: TargetPrediksi;
  jalur: BarisRamalan[];
  semua: BarisRamalan[];
  riwayat: Titik[];
  skor: SkorBacktest[];
  bulanan: Titik[];
  sitasi?: string;
}) {
  const d = target.desimal;
  const [awal] = jalur;
  const akhir = jalur[jalur.length - 1];
  const adaRentang = kalimatRentang(awal.lo80, awal.hi80, d) != null;
  const terakhir = riwayat[riwayat.length - 1];
  const efekBasis =
    target.kunci === "inflasi" && terakhir ? kalimatEfekBasis(jalur, terakhir[1], bulanan) : null;
  const caraSama = new Set(jalur.map((b) => b.model)).size === 1;
  const pembanding = caraSama ? [...new Set(semua.map((b) => b.model))].filter((m) => m !== awal.model) : [];
  return (
    <article className="kartu kartu-utama" id={`perkiraan-${target.kunci}`} data-topik={topik.kunci}>
      <h3 className="kartu-judul">{topik.nama}</h3>
      <p className="kartu-nama">
        {target.judul}, berangkat dari angka resmi {terakhir ? periode(terakhir[0]) : ""}
      </p>
      <p className="kartu-angka">
        <data value={awal.point}>{persen(awal.point, d)}</data>
      </p>
      <p className="prediksi-kalimat">{kalimatPerkiraan(topik.awalanPerkiraan, awal, d)}</p>
      {!adaRentang && <p className="catatan">{TANPA_RENTANG}</p>}
      {akhir !== awal && <p className="prediksi-lanjut">{kalimatPerkiraan("Untuk", akhir, d)}</p>}
      <GrafikPerkiraan
        riwayat={riwayat.slice(target.kunci === "inflasi" ? -24 : target.kunci === "pertumbuhan" ? -12 : -8)}
        ramalan={jalur.map((b) => ({ periode: b.ref_period, titik: b.point, bawah: b.lo80, atas: b.hi80 }))}
        nama={target.judul}
        desimal={d}
      />
      <p className="label-angka label-perkiraan">Perkiraan Con-Fore, bukan angka resmi</p>
      <p className="artinya">
        <strong>Artinya buatmu:</strong> {artinyaPerkiraan(target.kunci, awal.point)}
      </p>
      <details className="rincian-kartu">
        <summary>
          Kenapa perkiraannya begini<span className="sr-only"> {target.judul}</span>
        </summary>
        <div className="lipat-isi">
          {kalimatCara(target, jalur, skor).map((k) => (
            <p key={k}>{k}</p>
          ))}
          {efekBasis && <p>{efekBasis}</p>}
          <p>{UJI_PENGGERAK[target.kunci]}</p>
          <p>
            Rentangnya menggambarkan masa biasa. Guncangan besar seperti COVID bisa membuat angkanya jauh di luar
            rentang ini.
          </p>
          <dl className="rincian">
            {sitasi && (
              <div>
                <dt>Angka resmi</dt>
                <dd>
                  <Sitasi teks={sitasi} />
                </dd>
              </div>
            )}
            <div>
              <dt>Perkiraan dihitung Con-Fore</dt>
              <dd>{tanggal(awal.origin_date)}</dd>
            </div>
          </dl>
        </div>
      </details>
      <details className="rincian-kartu">
        <summary>
          Rincian per periode<span className="sr-only"> {target.judul}</span>
        </summary>
        <div className="lipat-isi">
          <p>
            {caraSama
              ? `Angka utama memakai cara: ${NAMA_MODEL[awal.model] ?? awal.model}.`
              : "Cara yang menjadi angka utama bisa berbeda antarperiode."}
          </p>
          <div className="gulir-tabel" role="region" aria-label={`Rincian perkiraan ${target.judul}`} tabIndex={0}>
            <table className="kepala-bungkus">
              <caption>Batas rentang 80% per periode</caption>
              <thead>
                <tr>
                  <th scope="col">Periode</th>
                  <th scope="col">Perkiraan</th>
                  <th scope="col">Batas bawah</th>
                  <th scope="col">Batas atas</th>
                  {!caraSama && <th scope="col">Cara</th>}
                  {pembanding.map((m) => (
                    <th scope="col" key={m}>
                      {NAMA_MODEL[m] ?? m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jalur.map((b) => (
                  <tr key={b.ref_period}>
                    <th scope="row">{periode(b.ref_period)}</th>
                    <td className="angka">{persen(b.point, d)}</td>
                    <td className="angka">{b.lo80 != null ? persen(b.lo80, d) : "-"}</td>
                    <td className="angka">{b.hi80 != null ? persen(b.hi80, d) : "-"}</td>
                    {!caraSama && <td>{NAMA_MODEL[b.model] ?? b.model}</td>}
                    {pembanding.map((m) => {
                      const lain = semua.find((x) => x.model === m && x.ref_period === b.ref_period);
                      return (
                        <td className="angka" key={m}>
                          {lain ? persen(lain.point, d) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <a href={`/api/csv/perkiraan/${target.kunci}`} download>
              Unduh rincian ini (CSV)<span className="sr-only"> {target.judul}</span>
            </a>
          </p>
        </div>
      </details>
    </article>
  );
}

function TabelImf({
  tahun,
  nilai,
  imf,
}: {
  tahun: number[];
  nilai: Map<number, NilaiTahun>;
  imf: Record<"pertumbuhan" | "inflasi" | "pengangguran", Titik[]>;
}) {
  const baris = [
    { kunci: "inflasi", nama: "Inflasi akhir tahun", d: 1 },
    { kunci: "pengangguran", nama: "Pengangguran", d: 2 },
    { kunci: "pertumbuhan", nama: "Pertumbuhan ekonomi", d: 1 },
  ] as const;
  return (
    <div className="gulir-tabel" role="region" aria-label="Perkiraan Con-Fore dan proyeksi IMF" tabIndex={0}>
      <table className="kepala-bungkus">
        <caption>Perkiraan Con-Fore dan proyeksi IMF, per tahun</caption>
        <thead>
          <tr>
            <th scope="col">Angka</th>
            <th scope="col">Tahun</th>
            <th scope="col">Perkiraan Con-Fore</th>
            <th scope="col">Proyeksi IMF</th>
          </tr>
        </thead>
        <tbody>
          {baris.flatMap(({ kunci, nama, d }) =>
            tahun.map((t) => {
              const c = nilai.get(t)?.[kunci];
              const i = imf[kunci].find((x) => x[0] === String(t))?.[1];
              return (
                <tr key={`${kunci}-${t}`}>
                  <th scope="row">{nama}</th>
                  <td className="angka">{t}</td>
                  <td className="angka">{c != null ? persen(c, d) : "-"}</td>
                  <td className="angka">{i != null ? persen(i, d) : "-"}</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function KeDepan() {
  const idResmi = TARGET_PREDIKSI.map((t) => t.seri);
  const [ramalan, skor, rekam, status, target, meta, grafik] = await Promise.all([
    bacaRamalan(),
    bacaSkorBacktest(),
    bacaRekamJejak(),
    bacaStatus(),
    bacaTarget(),
    bacaMeta(),
    bacaGrafik([...idResmi, ...TARGET_PREDIKSI.map((t) => t.imf), SERI_BULANAN, SERI_PDB_TAHUNAN]),
  ]);

  const jalurPer = new Map(TARGET_PREDIKSI.map((t) => [t.kunci, jalurUtama(ramalan, t.seri)]));
  const siap = TARGET_PREDIKSI.every((t) => jalurPer.get(t.kunci)?.length);
  if (!siap) {
    return (
      <>
        <BarisTanya kini="ke-depan" />
        <h1>Ke depan bagaimana?</h1>
        <p>
          Perkiraan belum tersedia. Halaman ini terisi setelah pembaruan otomatis berikutnya berhasil. Sementara itu,
          angka resmi terakhir ada di halaman <Link href="/indonesia">Indonesia</Link>.
        </p>
      </>
    );
  }

  const sitasi = (seri: string) => meta.find((m) => m.series_id === seri)?.citation;
  const resmiPer = (kunci: string) => titikSeri(grafik, TARGET_PREDIKSI.find((t) => t.kunci === kunci)!.seri);
  const jalur = {
    pdb: jalurPer.get("pertumbuhan")!,
    inflasi: jalurPer.get("inflasi")!,
    tpt: jalurPer.get("pengangguran")!,
  };
  const resmi = { pdb: resmiPer("pertumbuhan"), inflasi: resmiPer("inflasi"), tpt: resmiPer("pengangguran") };
  const dibuat = jalur.inflasi[0].origin_date;

  // Pembanding IMF: tahun perkiraan dan tahun sesudahnya.
  const tahun = tahunPerkiraan(jalur.pdb);
  const nilaiTahun = new Map<number, NilaiTahun>();
  for (const t of tahun != null ? [tahun, tahun + 1] : []) {
    const n = nilaiTahunPerkiraan(t, resmi, jalur);
    if (n) nilaiTahun.set(t, n);
  }

  // Jangka panjang.
  const resmiTahunan = titikSeri(grafik, SERI_PDB_TAHUNAN);
  const imfPdb = titikSeri(grafik, "idn_gdp_growth_weo_a");
  const barisPanjang = barisJangkaPanjang(imfPdb, resmiTahunan, target);
  const kalimatPanjang = kalimatJangkaPanjang(barisPanjang, resmiTahunan);
  const dokumenRpjmn = target.find((x) => x.series_id === SERI_PDB_TAHUNAN && x.target_kind === "rpjmn");
  const sitasiImf = sitasi("idn_gdp_growth_weo_a");
  const imfTahunan = {
    pertumbuhan: imfPdb,
    inflasi: titikSeri(grafik, "idn_cpi_eop_weo_a"),
    pengangguran: titikSeri(grafik, "idn_unemp_weo_a"),
  };

  return (
    <div data-topik="ke-depan">
      <JsonLd data={jsonLdPerkiraan(ramalan, meta)} />
      <BarisTanya kini="ke-depan" />
      <h1>Ke depan bagaimana?</h1>
      <p className="data-per">Perkiraan terakhir dihitung {tanggal(dibuat)}</p>
      <BannerBasi terakhir={status.last_success_at} />
      <p className="pengantar">
        {ARTI_KEMUNGKINAN} Pada grafik, garis utuh adalah angka resmi, garis putus-putus perkiraan, dan pita
        rentangnya.
      </p>

      <section className="bagian" aria-labelledby="judul-perkiraan">
        <h2 id="judul-perkiraan" className="sr-only">
          Tiga perkiraan
        </h2>
        <div className="kisi-kartu kisi-utama">
          {TOPIK.map((topik) => {
            const t = TARGET_PREDIKSI.find((x) => x.kunci === topik.kartu)!;
            return (
              <KartuPerkiraan
                key={t.kunci}
                topik={topik}
                target={t}
                jalur={jalurPer.get(t.kunci)!}
                semua={ramalan.filter((b) => b.series_id === t.seri)}
                riwayat={titikSeri(grafik, t.seri)}
                skor={skor}
                bulanan={titikSeri(grafik, SERI_BULANAN)}
                sitasi={sitasi(t.seri)}
              />
            );
          })}
        </div>
      </section>

      <section className="bagian" aria-labelledby="judul-rekam">
        <h2 id="judul-rekam">Seberapa sering meleset</h2>
        {rekam.length > 0 && (
          <ul className="banding">
            {TOPIK.map((topik) => {
              const t = TARGET_PREDIKSI.find((x) => x.kunci === topik.kartu)!;
              const kalimat = kalimatCakupan(cakupanRentang(rekam, t.seri));
              return kalimat ? (
                <li key={topik.kunci}>
                  <strong>{topik.nama}:</strong> {kalimat}
                </li>
              ) : null;
            })}
          </ul>
        )}
        {rekam.length ? (
          <div className="gulir-tabel" role="region" aria-label="Perkiraan sungguhan dan angka rilisnya" tabIndex={0}>
            <table className="kepala-bungkus">
              <caption>Perkiraan terakhir sebelum angkanya terbit, dibanding rilis pertama</caption>
              <thead>
                <tr>
                  <th scope="col">Angka</th>
                  <th scope="col">Periode</th>
                  <th scope="col">Perkiraan</th>
                  <th scope="col">Rilis pertama</th>
                  <th scope="col">Meleset</th>
                  <th scope="col">Rentang</th>
                  <th scope="col">Di dalam rentang</th>
                </tr>
              </thead>
              <tbody>
                {rekam.map((r) => {
                  const t = TARGET_PREDIKSI.find((x) => x.seri === r.series_id);
                  const d = t?.desimal ?? 2;
                  const berentang = r.lo80 != null && r.hi80 != null;
                  const masuk = berentang && r.first_release_actual >= r.lo80! && r.first_release_actual <= r.hi80!;
                  return (
                    <tr key={`${r.series_id}-${r.ref_period}-${r.model}`}>
                      <th scope="row">{t?.judul ?? r.series_id}</th>
                      <td>{periode(r.ref_period)}</td>
                      <td className="angka">{persen(r.forecast, d)}</td>
                      <td className="angka">{persen(r.first_release_actual, d)}</td>
                      <td className="angka">{angka(r.abs_error, 2)} poin persen</td>
                      <td className="angka">{berentang ? `${persen(r.lo80!, d)} sampai ${persen(r.hi80!, d)}` : "-"}</td>
                      <td>{berentang ? (masuk ? "Ya" : "Tidak") : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Belum ada yang bisa dinilai. Perkiraan pertama dibuat 7 November 2026, jadi baris pertama muncul setelah
            angka resmi berikutnya terbit. Hasil yang meleset tetap ditampilkan.
          </p>
        )}
        <p className="catatan">
          Hasil uji setiap cara hitung dengan data lama ada di{" "}
          <Link href="/tentang-data#uji">Tentang data</Link>.
        </p>
      </section>

      <section className="bagian" aria-labelledby="judul-imf">
        <h2 id="judul-imf">Dibanding proyeksi IMF</h2>
        <p className="catatan">
          IMF memperbarui proyeksinya dua kali setahun, April dan Oktober, jadi angkanya bisa tertinggal dari data
          terbaru. Angka Con-Fore untuk pengangguran memakai survei Agustus, atau perkiraan terakhir yang tersedia bila
          survei itu masih terlalu jauh.
        </p>
        <TabelImf tahun={[...nilaiTahun.keys()]} nilai={nilaiTahun} imf={imfTahunan} />
        {sitasiImf && (
          <p className="catatan">
            Sumber proyeksi: <Sitasi teks={sitasiImf} />
          </p>
        )}
      </section>

      {barisPanjang.length > 0 && (
        <section className="bagian" aria-labelledby="judul-panjang">
          <h2 id="judul-panjang">Jangka panjang: proyeksi IMF dan target RPJMN</h2>
          {kalimatPanjang && <p>{kalimatPanjang}</p>}
          <div className="jangka-panjang">
            <div className="panel">
              <GrafikJangkaPanjang
                resmi={resmiTahunan}
                imf={barisPanjang.map((b): Titik => [String(b.tahun), b.imf])}
                target={barisPanjang.filter((b) => b.rpjmn != null).map((b): Titik => [String(b.tahun), b.rpjmn!])}
              />
              <p className="catatan">
                Garis utuh: angka resmi. Garis putus-putus: proyeksi IMF. Titik berongga: target RPJMN.
                {dokumenRpjmn && (
                  <>
                    {" "}
                    Sumber target: <a href={dokumenRpjmn.url}>{dokumenRpjmn.document}</a>.
                  </>
                )}
              </p>
            </div>
            <div className="gulir-tabel" role="region" aria-label="Proyeksi IMF jangka panjang" tabIndex={0}>
              <table className="kepala-bungkus">
                <caption>Proyeksi IMF per tahun</caption>
                <thead>
                  <tr>
                    <th scope="col">Tahun</th>
                    <th scope="col">Pertumbuhan</th>
                    <th scope="col">Target RPJMN</th>
                    <th scope="col">Inflasi akhir tahun</th>
                    <th scope="col">Pengangguran</th>
                  </tr>
                </thead>
                <tbody>
                  {barisPanjang.map((b) => (
                    <tr key={b.tahun}>
                      <th scope="row">{b.tahun}</th>
                      <td className="angka">{persen(b.imf, 1)}</td>
                      <td className="angka">{b.rpjmn != null ? persen(b.rpjmn, 1) : "-"}</td>
                      <td className="angka">
                        {persen(imfTahunan.inflasi.find((x) => x[0] === String(b.tahun))?.[1] ?? NaN, 1)}
                      </td>
                      <td className="angka">
                        {persen(imfTahunan.pengangguran.find((x) => x[0] === String(b.tahun))?.[1] ?? NaN, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="bagian" aria-label="Cara menghitung">
        <details className="lipat">
          <summary>Bagaimana perkiraan ini dihitung?</summary>
          <p>
            Perkiraan selalu berangkat dari angka resmi terakhir. Untuk setiap angka, beberapa cara hitung diuji dengan
            data lama, dan yang paling jarang meleset menjadi angka utama. Cara sederhana boleh menang, dan hasil yang
            kalah tetap ditampilkan.
          </p>
          <p>
            Cara yang dibandingkan, cara mengujinya, dan arti rentangnya ada di{" "}
            <Link href="/tentang-data#perkiraan">Tentang data</Link>.
          </p>
        </details>
      </section>

      <Berikutnya
        tautan={[{ href: "/indonesia", tanya: "Kembali ke ringkasan", teks: "Lihat keempat jawaban di halaman Indonesia" }]}
      />
    </div>
  );
}
