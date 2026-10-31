// Tab Data (beranda): segitiga data resmi, tiga angka utama, penggerak, dan target resmi.
// Tanpa ramalan. Semua data dibaca di server lalu di-cache (ISR); browser tidak memanggil Supabase.

import Link from "next/link";
import { KartuKosong, KartuSeri, TabelTarget } from "@/components/Kartu";
import { BannerBasi, PilihLensa } from "@/components/Klien";
import { Segitiga } from "@/components/Segitiga";
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
import { JUDUL_KARTU, PENGGERAK, SERI_KARTU, STATUS_VERIFIKASI, namaPendek, type KunciKartu } from "@/lib/konten";
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
    bacaGrafik([...Object.values(SERI_SEGITIGA), ...idKartu, ...idPenggerak], true),
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
  const tahunTarget = ringkasan?.tahun ?? 0;
  const targetTerdekat = target.filter((t) => t.year >= tahunTarget && t.target_kind !== "rpjmn");
  const adaBerita = ringkasan?.target?.sumber.some((s) => s.verification === "berita");

  return (
    <>
      <section className="pembuka" aria-labelledby="judul-halaman">
        <h1 id="judul-halaman">Kondisi ekonomi Indonesia hari ini</h1>
        <p>
          Tiga angka yang paling terasa dalam hidup sehari-hari: seberapa cepat ekonomi tumbuh,
          seberapa cepat harga naik, dan seberapa banyak orang yang belum mendapat kerja. Tab ini hanya
          berisi data yang sudah terbit, tanpa ramalan.
        </p>
        <p className="catatan">
          Pembaruan otomatis terakhir: {waktuWIB(status.last_success_at)}
          {status.last_run_status === "partial" && " (sebagian sumber gagal diambil)"}.
        </p>
      </section>

      <BannerBasi terakhir={status.last_success_at} />
      {status.stale_sources.length > 0 && (
        <div className="banner" role="note">
          Sebagian angka dari {status.stale_sources.map(namaPendek).join(", ")} belum berhasil
          diperbarui. Angka yang terdampak ditandai &quot;terlambat diperbarui&quot;.
        </div>
      )}

      <section aria-labelledby="judul-ringkasan">
        <h2 id="judul-ringkasan">
          Ringkasan {ringkasan ? `tahun ${ringkasan.tahun}` : ""}: segitiga keseimbangan
        </h2>
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
        <h2 id="judul-angka">Tiga angka utama</h2>
        <div className="kisi-kartu kisi-utama">
          {(Object.keys(SERI_KARTU) as KunciKartu[]).map((kunci) => {
            const id = SERI_KARTU[kunci].find((s) => nilaiPer.has(s) && metaPer.has(s));
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
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="judul-penggerak">
        <h2 id="judul-penggerak">Penggerak: yang ikut mendorong ketiga angka</h2>
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
