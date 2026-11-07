// Tab Prediksi (PRD 4.1): segitiga perkiraan, tiga perkiraan dengan rentang, pembanding proyeksi IMF,
// panel jangka panjang, dan rekam jejak. Semua angka berlabel perkiraan dan berangkat dari angka resmi.

import type { Metadata } from "next";
import Link from "next/link";
import { GrafikJangkaPanjang, GrafikPerkiraan } from "@/components/Grafik";
import { BarisInstrumen, Sitasi } from "@/components/Kartu";
import { BannerBasi, PilihLensa } from "@/components/Klien";
import { Langit } from "@/components/Langit";
import { DaftarStatus, Segitiga } from "@/components/Segitiga";
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
import {
  NAMA_MODEL,
  SERI_BULANAN,
  SERI_PDB_TAHUNAN,
  TARGET_PREDIKSI,
  artinyaPerkiraan,
  barisJangkaPanjang,
  jalurUtama,
  kalimatCara,
  kalimatEfekBasis,
  kalimatJangkaPanjang,
  maeModel,
  modelTerurut,
  nilaiTahunPerkiraan,
  persen,
  tahunPerkiraan,
  teksRentang,
  type TargetPrediksi,
} from "@/lib/prediksi";
import { dataTahunan, ringkasanTahun, type Lensa } from "@/lib/ringkasan";
import { SERI_SEGITIGA, tahunLengkap, type NilaiTahun, type Skor } from "@/lib/skor";

export const metadata: Metadata = {
  title: "Prediksi",
  description:
    "Perkiraan pertumbuhan, inflasi, dan pengangguran Indonesia, lengkap dengan rentang, pembanding proyeksi IMF, dan catatan seberapa sering perkiraan itu meleset.",
};

// 6 jam; pipeline memanggil /api/revalidate setelah ramalan baru terbit.
export const revalidate = 21600;

function PanelLensa({
  lensa,
  pembanding,
  kelas,
  id,
}: {
  lensa: Lensa;
  pembanding?: Skor;
  kelas: string;
  id: string;
}) {
  return (
    <div className={kelas}>
      <div className="ringkasan">
        <Segitiga skor={lensa.skor} pembanding={pembanding} labelId={id} />
        <div>
          <DaftarStatus skor={lensa.skor} status={lensa.status} />
          <p id={id} className="kalimat-ringkasan">
            {lensa.kalimat}
          </p>
        </div>
      </div>
    </div>
  );
}

function KartuPerkiraan({
  target,
  jalur,
  semua,
  riwayat,
  skor,
  bulanan,
  sitasi,
}: {
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
  const rentang = teksRentang(awal.lo80, awal.hi80, d);
  const rentangAkhir = teksRentang(akhir.lo80, akhir.hi80, d);
  const terakhir = riwayat[riwayat.length - 1];
  const efekBasis =
    target.kunci === "inflasi" && terakhir ? kalimatEfekBasis(jalur, terakhir[1], bulanan) : null;
  const caraSama = new Set(jalur.map((b) => b.model)).size === 1;
  const pembanding = caraSama ? [...new Set(semua.map((b) => b.model))].filter((m) => m !== awal.model) : [];
  return (
    <article className="kartu kartu-utama" id={`perkiraan-${target.kunci}`}>
      <h3 className="kartu-judul">{target.judul}</h3>
      <p className="kartu-nama">Berangkat dari angka resmi {terakhir ? periode(terakhir[0]) : ""}</p>
      <p className="kartu-angka">
        <data value={awal.point}>{persen(awal.point, d)}</data>
      </p>
      <p className="kartu-periode">Perkiraan {periode(awal.ref_period)}</p>
      <p className="prediksi-rentang">
        {rentang ? `Rentang 80%: ${rentang}` : "Rentang belum tersedia, karena uji dengan data lama untuk jarak ini masih sedikit."}
      </p>
      {akhir !== awal && (
        <p className="prediksi-lanjut">
          Sampai {periode(akhir.ref_period)}: {persen(akhir.point, d)}
          {rentangAkhir ? ` (rentang 80%: ${rentangAkhir})` : ""}
        </p>
      )}
      <GrafikPerkiraan
        riwayat={riwayat.slice(target.kunci === "inflasi" ? -24 : target.kunci === "pertumbuhan" ? -12 : -8)}
        ramalan={jalur.map((b) => ({ periode: b.ref_period, titik: b.point, bawah: b.lo80, atas: b.hi80 }))}
        nama={target.judul}
        desimal={d}
      />
      <p className="lencana-baris">
        <span className="lencana lencana-perkiraan">perkiraan Con-Fore, bukan angka resmi</span>
      </p>
      <p className="artinya">
        <strong>Artinya buatmu:</strong> {artinyaPerkiraan(target.kunci, awal.point)}
      </p>
      <details className="rincian-kartu">
        <summary>
          Kenapa perkiraannya begini<span className="sr-only"> {target.judul}</span>
        </summary>
        <div className="lipat-isi">
          {kalimatCara(target, jalur, skor).map((k) => (
            <p key={k} className="catatan">
              {k}
            </p>
          ))}
          {efekBasis && <p className="catatan">{efekBasis}</p>}
          {target.kunci === "pertumbuhan" && (
            <p className="catatan">
              Ekspor, impor, produksi industri, wisatawan, uang beredar, dan harga komoditas sudah diuji, dan tidak
              ada yang membuat perkiraan lebih akurat. Angka PDB memang sangat stabil di luar masa COVID.
            </p>
          )}
          {target.kunci === "inflasi" && (
            <p className="catatan">
              Kurs, harga minyak, dan BI-Rate sudah diuji dan tidak menurunkan galat, jadi tidak dipakai. Kebijakan
              baru, misalnya perubahan harga BBM atau tarif listrik, belum masuk perkiraan ini.
            </p>
          )}
          {target.kunci === "pengangguran" && (
            <p className="catatan">
              Pertumbuhan PDB sudah diuji dan tidak membuat perkiraan lebih akurat. Sampelnya masih kecil, jadi
              perkiraan ini eksperimental.
            </p>
          )}
          <p className="catatan">
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
      <details className="rincian-lipat">
        <summary>
          Rincian per periode<span className="sr-only"> {target.judul}</span>
        </summary>
        <div className="gulir-tabel" role="region" aria-label={`Rincian perkiraan ${target.judul}`} tabIndex={0}>
          <table className="kepala-bungkus">
            <caption>{caraSama ? `Angka utama: ${NAMA_MODEL[awal.model] ?? awal.model}` : "Angka utama per periode"}</caption>
            <thead>
              <tr>
                <th scope="col">Periode</th>
                <th scope="col">Perkiraan</th>
                <th scope="col">Rentang 80%</th>
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
                  <td className="angka">{teksRentang(b.lo80, b.hi80, d) ?? "-"}</td>
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
    { kunci: "pertumbuhan", nama: "Pertumbuhan ekonomi", d: 1 },
    { kunci: "inflasi", nama: "Inflasi akhir tahun", d: 1 },
    { kunci: "pengangguran", nama: "Pengangguran", d: 2 },
  ] as const;
  return (
    <div className="gulir-tabel" role="region" aria-label="Perkiraan Con-Fore dan proyeksi IMF" tabIndex={0}>
      <table className="kepala-bungkus">
        <caption>Perkiraan Con-Fore dan proyeksi IMF, per tahun</caption>
        <thead>
          <tr>
            <th scope="col">Indikator</th>
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

function TabelSkor({
  target,
  skor,
  jendela,
  judul,
  utama,
}: {
  target: TargetPrediksi;
  skor: SkorBacktest[];
  jendela: "normal" | "uji";
  judul: string;
  utama: Map<number, string>;
}) {
  const ada = target.horizonRekam.filter((h) =>
    skor.some((s) => s.series_id === target.seri && s.horizon === h && s.window_name === jendela),
  );
  if (!ada.length) return null;
  const urutan = modelTerurut(skor, target.seri, ada[0], utama.get(ada[0]) ?? "");
  return (
    <div className="gulir-tabel" role="region" aria-label={judul} tabIndex={0}>
      <table className="kepala-bungkus">
        <caption>{judul}</caption>
        <thead>
          <tr>
            <th scope="col">Cara</th>
            {ada.map((h) => (
              <th scope="col" key={h} className="angka">
                {target.namaHorizon(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {urutan.map((m) => (
            <tr key={m}>
              <th scope="row">{NAMA_MODEL[m] ?? m}</th>
              {ada.map((h) => {
                const mae = maeModel(skor, target.seri, m, h, jendela);
                return (
                  <td key={h} className={utama.get(h) === m ? "angka angka-utama" : "angka"}>
                    {mae != null ? angka(mae, 2) : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Prediksi() {
  const idResmi = TARGET_PREDIKSI.map((t) => t.seri);
  const [ramalan, skor, rekam, status, target, meta, grafik] = await Promise.all([
    bacaRamalan(),
    bacaSkorBacktest(),
    bacaRekamJejak(),
    bacaStatus(),
    bacaTarget(),
    bacaMeta(),
    bacaGrafik([
      ...idResmi,
      ...TARGET_PREDIKSI.map((t) => t.imf),
      ...Object.values(SERI_SEGITIGA),
      SERI_BULANAN,
    ]),
  ]);

  const jalurPer = new Map(TARGET_PREDIKSI.map((t) => [t.kunci, jalurUtama(ramalan, t.seri)]));
  const siap = TARGET_PREDIKSI.every((t) => jalurPer.get(t.kunci)?.length);
  if (!siap) {
    return (
      <section className="pembuka prosa">
        <h1>Perkiraan ekonomi Indonesia</h1>
        <p>
          Perkiraan belum tersedia. Halaman ini akan terisi setelah pembaruan otomatis berikutnya berhasil.
          Sementara itu, kondisi terkini dari data yang sudah terbit ada di <Link href="/">tab Data</Link>.
        </p>
      </section>
    );
  }

  const sitasi = (seri: string) => meta.find((m) => m.series_id === seri)?.citation;
  const [gPdb, gInflasi, gTpt] = TARGET_PREDIKSI.map((t) => titikSeri(grafik, t.seri));
  const jalur = {
    pdb: jalurPer.get("pertumbuhan")!,
    inflasi: jalurPer.get("inflasi")!,
    tpt: jalurPer.get("pengangguran")!,
  };
  const resmi = { pdb: gPdb, inflasi: gInflasi, tpt: gTpt };
  const dibuat = jalur.inflasi[0].origin_date;

  // Segitiga: tahun perkiraan dibanding tahun terakhir yang ketiga angka resminya sudah terbit.
  const tahunan = dataTahunan(grafik);
  const tahunResmi = tahunLengkap(tahunan);
  const tahun = tahunPerkiraan(jalur.pdb);
  const nilaiTahun = new Map<number, NilaiTahun>();
  for (const t of tahun != null ? [tahun, tahun + 1] : []) {
    const n = nilaiTahunPerkiraan(t, resmi, jalur);
    if (n) nilaiTahun.set(t, n);
  }
  const nilaiUtama = tahun != null ? nilaiTahun.get(tahun) : undefined;
  const ringkasan =
    tahun != null && nilaiUtama
      ? ringkasanTahun(tahun, new Map(tahunan).set(tahun, nilaiUtama), target, `Perkiraan tahun ${tahun}`)
      : null;
  const pembanding = tahunResmi != null ? ringkasanTahun(tahunResmi, tahunan, target) : null;

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
    <>
      <Langit />
      <section className="sampul" aria-labelledby="judul-halaman">
        <div className="sampul-atas">
          <h1 id="judul-halaman" className="sampul-judul">
            Ke mana arahnya, <em>dan seberapa yakin.</em>
          </h1>
          <p className="sampul-isi">
            Perkiraan pertumbuhan, inflasi, dan pengangguran Indonesia. Semua angka di tab ini perkiraan, bukan angka
            resmi dan bukan janji. Setiap perkiraan berangkat dari angka resmi terakhir, disertai rentang dan catatan
            seberapa sering perkiraan itu meleset.
          </p>
        </div>
        <div className="instrumen">
          <div className="instrumen-kepala">
            <p className="alis">Perkiraan Con-Fore</p>
            <p className="alis">Bukan angka resmi</p>
          </div>
          {TARGET_PREDIKSI.map((t, i) => {
            const [awal] = jalurPer.get(t.kunci)!;
            const rentang = teksRentang(awal.lo80, awal.hi80, t.desimal);
            return (
              <BarisInstrumen
                key={t.kunci}
                judul={t.judul}
                nilai={persen(awal.point, t.desimal)}
                keterangan={`${periode(awal.ref_period)}, ${rentang ? `rentang 80%: ${rentang}` : "rentang belum tersedia"}`}
                titik={[gPdb, gInflasi, gTpt][i]}
                frekuensi={t.kunci === "pertumbuhan" ? "Q" : "M"}
                href={`#perkiraan-${t.kunci}`}
              />
            );
          })}
        </div>
        <div className="sampul-bawah">
          <ul className="sampul-angka">
            <li>
              <strong>{new Set(ramalan.map((b) => b.model)).size}</strong> cara dibandingkan
            </li>
            <li>
              <strong>sejak 2012</strong> diuji dengan data lama
            </li>
          </ul>
          <p className="sampul-aksi">
            <a href="#judul-rekam" className="tombol tombol-utama">
              Lihat rekam jejak <span aria-hidden="true">&darr;</span>
            </a>
            <Link href="/cara-kerja#perkiraan" className="tombol">
              Cara mengujinya
            </Link>
          </p>
          <p className="catatan">Isinya penjelasan angka, bukan nasihat keuangan. Perkiraan terakhir dihitung {tanggal(dibuat)}.</p>
        </div>
      </section>

      <BannerBasi terakhir={status.last_success_at} />

      {ringkasan && (
        <section aria-labelledby="judul-ringkasan">
          <p className="alis">Ringkasan perkiraan tahun {tahun}</p>
          <h2 id="judul-ringkasan">Segitiga keseimbangan</h2>
          <div className="panel">
            <p className="catatan">
              Garis putus-putus adalah perkiraan {tahun}. Garis tipis adalah angka resmi {tahunResmi}. Makin besar
              segitiganya, makin baik keadaannya. Pilih pembandingnya:
            </p>
            <PilihLensa />
            <PanelLensa
              lensa={ringkasan.masaLalu}
              pembanding={pembanding?.masaLalu.skor}
              kelas="lensa-masa-lalu"
              id="kalimat-masa-lalu"
            />
            {ringkasan.target ? (
              <PanelLensa
                lensa={ringkasan.target}
                pembanding={pembanding?.target?.skor}
                kelas="lensa-target"
                id="kalimat-target"
              />
            ) : (
              <div className="lensa-target">
                <p>Lensa target belum tersedia untuk tahun {tahun}, karena target resminya belum lengkap.</p>
              </div>
            )}
            <p className="catatan">
              Angka {tahun} memakai angka resmi yang sudah terbit, ditambah perkiraan untuk sisanya. Pertumbuhan dari
              rata-rata empat kuartal, inflasi dari Desember, dan pengangguran dari ronde Agustus. Cara menghitung
              skornya ada di <Link href="/cara-kerja#skor">Cara kerja</Link>.
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="judul-perkiraan">
        <p className="alis">Pertumbuhan, inflasi, pengangguran</p>
        <h2 id="judul-perkiraan">Tiga perkiraan</h2>
        <p className="catatan">
          Pada grafik, garis utuh adalah angka resmi, garis putus-putus adalah perkiraan, dan pita adalah rentang
          80%: pada uji dengan data lama, sekitar 8 dari 10 angka di masa biasa jatuh di dalam pita selebar ini.
        </p>
        <div className="kisi-kartu kisi-utama">
          {TARGET_PREDIKSI.map((t, i) => (
            <KartuPerkiraan
              key={t.kunci}
              target={t}
              jalur={jalurPer.get(t.kunci)!}
              semua={ramalan.filter((b) => b.series_id === t.seri)}
              riwayat={[gPdb, gInflasi, gTpt][i]}
              skor={skor}
              bulanan={titikSeri(grafik, SERI_BULANAN)}
              sitasi={sitasi(t.seri)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="judul-imf">
        <p className="alis">Pembanding</p>
        <h2 id="judul-imf">Dibanding proyeksi IMF</h2>
        <p className="catatan">
          IMF memperbarui proyeksinya dua kali setahun, April dan Oktober, jadi angkanya bisa tertinggal dari data
          terbaru. Angka Con-Fore untuk pengangguran memakai ronde Agustus, atau perkiraan terakhir yang tersedia
          bila ronde itu masih terlalu jauh.
        </p>
        <TabelImf tahun={[...nilaiTahun.keys()]} nilai={nilaiTahun} imf={imfTahunan} />
        {sitasiImf && (
          <p className="catatan">
            Sumber proyeksi: <Sitasi teks={sitasiImf} />
          </p>
        )}
      </section>

      {barisPanjang.length > 0 && (
        <section aria-labelledby="judul-panjang">
          <p className="alis">Jangka panjang</p>
          <h2 id="judul-panjang">Proyeksi IMF dan target RPJMN</h2>
          <p className="catatan">
            Di luar jangka pendek, Con-Fore tidak membuat model sendiri. Panel ini memakai proyeksi IMF, dan
            membandingkannya dengan target pertumbuhan dalam RPJMN 2025-2029 (Perpres 12/2025).
          </p>
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

      <section aria-labelledby="judul-rekam">
        <p className="alis">Rekam jejak</p>
        <h2 id="judul-rekam">Seberapa sering meleset</h2>
        <h3>Perkiraan sungguhan</h3>
        {rekam.length ? (
          <div className="gulir-tabel" role="region" aria-label="Perkiraan sungguhan dan angka rilisnya" tabIndex={0}>
            <table className="kepala-bungkus">
              <caption>Perkiraan terakhir sebelum angkanya terbit, dibanding rilis pertama</caption>
              <thead>
                <tr>
                  <th scope="col">Indikator</th>
                  <th scope="col">Periode</th>
                  <th scope="col">Perkiraan</th>
                  <th scope="col">Rilis pertama</th>
                  <th scope="col">Meleset</th>
                </tr>
              </thead>
              <tbody>
                {rekam.map((r) => {
                  const t = TARGET_PREDIKSI.find((x) => x.seri === r.series_id);
                  const d = t?.desimal ?? 2;
                  return (
                    <tr key={`${r.series_id}-${r.ref_period}-${r.model}`}>
                      <th scope="row">{t?.judul ?? r.series_id}</th>
                      <td>{periode(r.ref_period)}</td>
                      <td className="angka">{persen(r.forecast, d)}</td>
                      <td className="angka">{persen(r.first_release_actual, d)}</td>
                      <td className="angka">{angka(r.abs_error, 2)} poin persen</td>
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
        <h3>Uji dengan data lama</h3>
        <p className="catatan">
          Sejak 2012, setiap bulan, Con-Fore meramal hanya dengan data yang sudah terbit saat itu, lalu membandingkan
          dengan angka yang kemudian terbit. Angka di tabel adalah rata-rata meleset dalam poin persen, jadi makin
          kecil makin baik. Yang tebal adalah angka utama. Kolomnya menunjukkan jarak dari angka resmi terakhir. Uji
          ini memakai angka terbaru, bukan rilis pertama, jadi hasilnya bisa sedikit lebih baik daripada kenyataan.
        </p>
        <div className="dua-kolom">
          {TARGET_PREDIKSI.map((t) => {
            const utama = new Map(
              skor
                .filter((s) => s.series_id === t.seri && s.is_main && s.window_name === "normal")
                .map((s) => [s.horizon, s.model]),
            );
            return (
              <div key={t.kunci}>
                <h4>{t.judul}</h4>
                <TabelSkor target={t} skor={skor} jendela="normal" judul="Di luar masa COVID" utama={utama} />
                <TabelSkor target={t} skor={skor} jendela="uji" judul="Sejak 2022" utama={utama} />
              </div>
            );
          })}
        </div>
        <p className="catatan">
          Penjelasan modelnya ada di <Link href="/cara-kerja#perkiraan">Cara kerja</Link>. Sumber data dan syarat
          penggunaannya ada di <Link href="/sumber">Sumber data</Link>.
        </p>
      </section>
    </>
  );
}
