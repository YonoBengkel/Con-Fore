// Kartu angka (tiga angka utama dan panel penggerak), sitasi bertaut, dan tabel target resmi.

import Link from "next/link";
import type { MetaSeri, NilaiTerakhir, Target, Titik } from "@/lib/data";
import { angka, nilaiPendek, perubahan, periode, tanggal } from "@/lib/format";
import {
  NAMA_TARGET,
  STATUS_VERIFIKASI,
  artinyaBuatmu,
  keteranganJadwal,
  labelSeri,
} from "@/lib/konten";
import { GarisKecil } from "./Grafik";

/** Teks sitasi dengan URL di dalamnya dijadikan tautan. */
export function Sitasi({ teks }: { teks: string }) {
  const bagian = teks.split(/(https?:\/\/\S+)/);
  return (
    <>
      {bagian.map((b, i) =>
        /^https?:\/\//.test(b) ? (
          <a key={i} href={b} rel="noopener noreferrer">
            {b.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          b
        ),
      )}
    </>
  );
}

export function Lencana({ meta, basi }: { meta: MetaSeri; basi: boolean }) {
  return (
    <p className="lencana-baris">
      <span className="lencana">{labelSeri(meta)}</span>
      {basi && <span className="lencana lencana-basi">terlambat diperbarui</span>}
    </p>
  );
}

export function KartuSeri({
  judul,
  meta,
  nilai,
  titik,
  kalender,
  utama = false,
}: {
  judul?: string;
  meta: MetaSeri;
  nilai: NilaiTerakhir;
  titik: Titik[];
  /** calendar_source untuk next_release_date seri ini, bila tercatat. */
  kalender?: string;
  utama?: boolean;
}) {
  const ubah = perubahan(nilai.value, nilai.previous_value, meta.unit, meta.concept, meta.frequency);
  const artinya = artinyaBuatmu(meta.series_id, nilai.value);
  const H = utama ? "h3" : "h4";
  const satuanPanjang = meta.unit.startsWith("%") ? meta.unit.replace(/^%\s*/, "") : meta.unit;
  return (
    <article className={utama ? "kartu kartu-utama" : "kartu"}>
      <H className="kartu-judul">{judul ?? meta.name_id}</H>
      {judul && <p className="kartu-nama">{meta.name_id}</p>}
      <p className="kartu-angka">
        <data value={nilai.value}>{nilaiPendek(nilai.value, meta.unit, meta.concept)}</data>
        {satuanPanjang && <span className="kartu-satuan"> {satuanPanjang}</span>}
      </p>
      <p className="kartu-periode">
        {periode(nilai.period)}
        {ubah && <span className="kartu-ubah">, {ubah}</span>}
      </p>
      <GarisKecil titik={titik} frekuensi={meta.frequency} />
      <Lencana meta={meta} basi={nilai.is_stale} />
      {artinya && (
        <p className="artinya">
          <strong>Artinya buatmu:</strong> {artinya}
        </p>
      )}
      <dl className="rincian">
        <div>
          <dt>Sumber</dt>
          <dd>
            <Sitasi teks={meta.citation} />
          </dd>
        </div>
        {nilai.release_date && (
          <div>
            <dt>Tanggal rilis</dt>
            <dd>{tanggal(nilai.release_date)}</dd>
          </div>
        )}
        <div>
          <dt>Dilihat Con-Fore</dt>
          <dd>{tanggal(nilai.seen_date)}</dd>
        </div>
        {meta.next_release_date && (
          <div>
            <dt>Rilis berikutnya</dt>
            <dd>
              {tanggal(meta.next_release_date)} ({keteranganJadwal(meta, kalender)})
            </dd>
          </div>
        )}
      </dl>
      <p className="kartu-aksi">
        <Link href={`/indikator/${meta.series_id}`}>
          Riwayat lengkap<span className="sr-only"> {meta.name_id}</span>
        </Link>
        <a href={`/api/csv/${meta.series_id}`} download>
          Unduh CSV<span className="sr-only"> {meta.name_id}</span>
        </a>
      </p>
    </article>
  );
}

export function KartuKosong({ judul }: { judul: string }) {
  return (
    <article className="kartu kartu-utama kartu-kosong">
      <h3 className="kartu-judul">{judul}</h3>
      <p>Data belum tersedia. Angka ini akan muncul setelah pembaruan otomatis berikutnya berhasil.</p>
    </article>
  );
}

const NAMA_INDIKATOR: Record<string, string> = {
  idn_gdp_growth_a: "Pertumbuhan ekonomi",
  idn_cpi_eop_a: "Inflasi akhir tahun",
  idn_unemp_a: "Pengangguran terbuka",
};

export function teksTarget(t: Target): string {
  const p = (n: number) => `${angka(n, t.series_id === "idn_unemp_a" ? 2 : 1)}%`;
  if (t.target_kind === "pmk" && t.value != null) {
    return `${p(t.value)} ± 1${t.lower != null && t.upper != null ? ` (${p(t.lower)} sampai ${p(t.upper)})` : ""}`;
  }
  if (t.lower != null && t.upper != null) return `${p(t.lower)} sampai ${p(t.upper)}`;
  if (t.value != null) return p(t.value);
  return "-";
}

export function TabelTarget({ target, judul }: { target: Target[]; judul: string }) {
  if (!target.length) return <p>Tabel target resmi belum tersedia.</p>;
  return (
    <div className="gulir-tabel" role="region" aria-label={judul} tabIndex={0}>
      <table className="tabel-tumpuk">
        <caption>{judul}</caption>
        <thead>
          <tr>
            <th scope="col">Indikator</th>
            <th scope="col">Tahun</th>
            <th scope="col">Dasar</th>
            <th scope="col">Target</th>
            <th scope="col">Dokumen sumber</th>
            <th scope="col">Status pemeriksaan</th>
          </tr>
        </thead>
        <tbody>
          {target.map((t) => (
            <tr key={`${t.series_id}-${t.year}-${t.target_kind}`}>
              <th scope="row">{NAMA_INDIKATOR[t.series_id] ?? t.series_id}</th>
              <td className="angka" data-label="Tahun">{t.year}</td>
              <td data-label="Dasar">{NAMA_TARGET[t.target_kind] ?? t.target_kind}</td>
              <td className="angka" data-label="Target">{teksTarget(t)}</td>
              <td data-label="Dokumen sumber">
                <a href={t.url} rel="noopener noreferrer">
                  {t.document}
                </a>
              </td>
              <td data-label="Status pemeriksaan">
                <span className={t.verification === "dokumen" ? "status status-ok" : "status status-berita"}>
                  {STATUS_VERIFIKASI[t.verification] ?? t.verification}
                </span>
                <span className="status-tanggal">diperiksa {tanggal(t.last_verified)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
