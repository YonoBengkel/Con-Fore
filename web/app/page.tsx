// Tab Data (beranda): segitiga data resmi, tiga angka utama, penggerak, dan target resmi.
// Tanpa ramalan. Semua data dibaca di server lalu di-cache (ISR); browser tidak memanggil Supabase.

import Link from "next/link";
import { BarisDataResmi, KartuKosong, KartuSeri, TabelTarget } from "@/components/Kartu";
import { BannerBasi, PilihLensa } from "@/components/Klien";
import { Langit } from "@/components/Langit";
import { DaftarStatus, Segitiga } from "@/components/Segitiga";
import {
  bacaGrafik,
  bacaKalender,
  bacaMeta,
  bacaNilai,
  bacaStatus,
  bacaTarget,
  titikSeri,
  type MetaSeri,
  type NilaiTerakhir,
} from "@/lib/data";
import { periode, waktuWIB } from "@/lib/format";
import {
  JUDUL_KARTU,
  KELOMPOK_INFLASI,
  PENGGERAK,
  SERI_FORMAL,
  SERI_KARTU,
  SERI_TPT_RONDE,
  STATUS_VERIFIKASI,
  adalahProyeksi,
  namaPendek,
  type KunciKartu,
} from "@/lib/konten";
import { kalimatPekerja } from "@/lib/pekerja";
import { buatRingkasan, type Lensa } from "@/lib/ringkasan";
import { SERI_SEGITIGA } from "@/lib/skor";

// 6 jam; pipeline memanggil /api/revalidate setelah setiap publikasi.
export const revalidate = 21600;

function PanelLensa({
  lensa,
  kelas,
  id,
  catatan,
}: {
  lensa: Lensa;
  kelas: string;
  id: string;
  catatan?: React.ReactNode;
}) {
  return (
    <div className={kelas}>
      <div className="ringkasan">
        <Segitiga skor={lensa.skor} labelId={id} />
        <div>
          <DaftarStatus skor={lensa.skor} status={lensa.status} />
          <p id={id} className="kalimat-ringkasan">
            {lensa.kalimat}
          </p>
          {catatan}
        </div>
      </div>
    </div>
  );
}

export default async function Beranda() {
  const idKartu = Object.values(SERI_KARTU).flat();
  const idPenggerak = PENGGERAK.flatMap((k) => k.seri);
  const [meta, nilai, status, target, grafik, kalender] = await Promise.all([
    bacaMeta(),
    bacaNilai(),
    bacaStatus(),
    bacaTarget(),
    bacaGrafik([...Object.values(SERI_SEGITIGA), ...idKartu, ...idPenggerak, SERI_FORMAL], true),
    bacaKalender(),
  ]);

  const metaPer = new Map<string, MetaSeri>(meta.map((m) => [m.series_id, m]));
  const nilaiPer = new Map<string, NilaiTerakhir>(nilai.map((n) => [n.series_id, n]));
  // Jadwal siapa yang menjadi next_release_date tiap seri (SCHEMA 2.2).
  const jadwal = (id: string) => {
    const tgl = metaPer.get(id)?.next_release_date?.slice(0, 10);
    return kalender.find((r) => r.series_id === id && r.release_date.slice(0, 10) === tgl)?.calendar_source;
  };
  const ringkasan = buatRingkasan(grafik, target);
  const pekerja = kalimatPekerja(titikSeri(grafik, SERI_FORMAL), titikSeri(grafik, SERI_TPT_RONDE));
  const tahunTarget = ringkasan?.tahun ?? 0;
  const targetTerdekat = target.filter((t) => t.year >= tahunTarget && t.target_kind !== "rpjmn");
  const adaBerita = ringkasan?.target?.sumber.some((s) => s.verification === "berita");
  const seriData = meta.filter((m) => !adalahProyeksi(m.series_id));
  const kunciKartu = Object.keys(SERI_KARTU) as KunciKartu[];
  const seriKartu = (kunci: KunciKartu) => SERI_KARTU[kunci].find((s) => nilaiPer.has(s) && metaPer.has(s));

  return (
    <>
      <Langit />
      <section className="sampul" aria-labelledby="judul-halaman">
        <div className="sampul-atas">
          <h1 id="judul-halaman" className="sampul-judul">
            Ekonomi Indonesia, <em>dalam tiga angka.</em>
          </h1>
          <p className="sampul-isi">
            Seberapa cepat ekonomi tumbuh, seberapa cepat harga naik, dan seberapa banyak orang yang belum
            mendapat kerja. Dari data resmi, dijelaskan dengan bahasa sehari-hari.
          </p>
        </div>
        <div className="instrumen">
          <div className="instrumen-kepala">
            <p className="alis">Indonesia</p>
            <p className="alis">Data terbit terakhir</p>
          </div>
          {kunciKartu.map((kunci) => {
            const id = seriKartu(kunci);
            if (!id) return null;
            return (
              <BarisDataResmi
                key={kunci}
                judul={JUDUL_KARTU[kunci]}
                meta={metaPer.get(id)!}
                nilai={nilaiPer.get(id)!}
                titik={titikSeri(grafik, id)}
              />
            );
          })}
        </div>
        <div className="sampul-bawah">
          <ul className="sampul-angka">
            <li>
              <strong>{seriData.length}</strong> seri data
            </li>
            <li>
              <strong>{new Set(seriData.map((m) => m.source_id)).size}</strong> lembaga sumber
            </li>
            <li>
              <strong>setiap hari</strong> diperbarui otomatis
            </li>
          </ul>
          <p className="sampul-aksi">
            <Link href="/prediksi" className="tombol tombol-utama">
              Lihat perkiraan <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link href="/cara-kerja" className="tombol">
              Cara membaca angkanya
            </Link>
          </p>
          <p className="catatan">
            Tab ini hanya berisi data yang sudah terbit, tanpa ramalan. Pembaruan otomatis terakhir:{" "}
            {waktuWIB(status.last_success_at)}
            {status.last_run_status === "partial" && " (sebagian sumber gagal diambil)"}.
          </p>
        </div>
      </section>

      <BannerBasi terakhir={status.last_success_at} />
      {status.stale_sources.length > 0 && (
        <div className="banner" role="note">
          Sebagian angka dari {status.stale_sources.map(namaPendek).join(", ")} belum berhasil
          diperbarui. Angka yang terdampak ditandai &quot;terlambat diperbarui&quot;.
        </div>
      )}

      <section aria-labelledby="judul-ringkasan">
        <p className="alis">Ringkasan {ringkasan ? `tahun ${ringkasan.tahun}` : ""}</p>
        <h2 id="judul-ringkasan">Segitiga keseimbangan</h2>
        {ringkasan ? (
          <div className="panel">
            <p className="catatan">
              Segitiga ini memakai tahun terakhir yang ketiga angkanya sudah terbit. Makin besar
              segitiganya, makin baik keadaannya. Pilih pembandingnya:
            </p>
            <PilihLensa />
            <PanelLensa lensa={ringkasan.masaLalu} kelas="lensa-masa-lalu" id="kalimat-masa-lalu" />
            {ringkasan.target ? (
              <PanelLensa
                lensa={ringkasan.target}
                kelas="lensa-target"
                id="kalimat-target"
                catatan={
                  adaBerita && (
                    <p className="catatan">
                      Sebagian target {ringkasan.tahun} masih{" "}
                      {STATUS_VERIFIKASI.berita.replace(/^dari /, "bersumber ")}. Lihat{" "}
                      <Link href="/sumber#target">tabel target</Link>.
                    </p>
                  )
                }
              />
            ) : (
              <div className="lensa-target">
                <p>
                  Lensa target belum tersedia untuk tahun {ringkasan.tahun}, karena target resminya
                  belum lengkap.
                </p>
              </div>
            )}
            <p className="catatan">
              Sumber angka segitiga: salinan IMF (World Economic Outlook) dari data BPS. Cara
              menghitung skornya ada di <Link href="/cara-kerja#skor">Cara kerja</Link>.
            </p>
          </div>
        ) : (
          <p>Ringkasan belum bisa dihitung karena data tahunan belum lengkap.</p>
        )}
      </section>

      <section aria-labelledby="judul-angka">
        <p className="alis">Yang paling terasa sehari-hari</p>
        <h2 id="judul-angka">Tiga angka utama</h2>
        <div className="kisi-kartu kisi-utama">
          {kunciKartu.map((kunci) => {
            const id = seriKartu(kunci);
            if (!id) return <KartuKosong key={kunci} judul={JUDUL_KARTU[kunci]} />;
            return (
              <KartuSeri
                key={kunci}
                utama
                judul={JUDUL_KARTU[kunci]}
                meta={metaPer.get(id)!}
                nilai={nilaiPer.get(id)!}
                titik={titikSeri(grafik, id)}
                kalender={jadwal(id)}
                tambahan={
                  kunci === "pengangguran"
                    ? pekerja?.porsi
                    : kunci === "inflasi" && nilaiPer.has(KELOMPOK_INFLASI[0].setahun)
                      ? "Rincian inti, harga diatur pemerintah, dan harga bergejolak ada di Riwayat lengkap."
                      : undefined
                }
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="judul-penggerak">
        <p className="alis">Penggerak</p>
        <h2 id="judul-penggerak">Yang ikut mendorong ketiga angka</h2>
        <p className="catatan">
          Harga komoditas, kurs, suku bunga, dan kondisi mitra dagang memengaruhi pertumbuhan dan
          inflasi Indonesia, biasanya dengan jeda beberapa bulan.
        </p>
        {PENGGERAK.map((kelompok) => {
          const ada = kelompok.seri.filter((s) => nilaiPer.has(s) && metaPer.has(s));
          if (!ada.length) return null;
          return (
            <div key={kelompok.judul}>
              <h3>{kelompok.judul}</h3>
              <div className="kisi-kartu kisi-penggerak">
                {ada.map((id) => (
                  <KartuSeri
                    key={id}
                    meta={metaPer.get(id)!}
                    nilai={nilaiPer.get(id)!}
                    titik={titikSeri(grafik, id)}
                    kalender={jadwal(id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="judul-target">
        <p className="alis">UU APBN dan PMK</p>
        <h2 id="judul-target">Target resmi pemerintah</h2>
        <p className="catatan">
          Target pertumbuhan dan pengangguran dari UU APBN, sasaran inflasi dari PMK. Daftar lengkap,
          termasuk tahun-tahun sebelumnya dan target RPJMN, ada di{" "}
          <Link href="/sumber#target">Sumber data</Link>.
        </p>
        <TabelTarget
          target={targetTerdekat}
          judul={`Target resmi ${tahunTarget ? `sejak ${periode(String(tahunTarget))}` : ""}`.trim()}
        />
      </section>
    </>
  );
}
