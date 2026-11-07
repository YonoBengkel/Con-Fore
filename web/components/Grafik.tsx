// Grafik garis sederhana sebagai SVG, digambar di server (browser hanya menerima SVG jadi).

import type { Titik } from "@/lib/data";
import { angka, desimalUntuk, periode } from "@/lib/format";
import { jarangkan } from "@/lib/riwayat";

function jalur(titik: Titik[], lebar: number, tinggi: number, kiri = 0, atas = 0) {
  const nilai = titik.map((t) => t[1]);
  const min = Math.min(...nilai);
  const max = Math.max(...nilai);
  const rentang = max - min || 1;
  const x = (i: number) => kiri + (titik.length > 1 ? (i * lebar) / (titik.length - 1) : lebar / 2);
  const y = (v: number) => atas + tinggi - ((v - min) / rentang) * tinggi;
  const d = titik.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(t[1]).toFixed(1)}`).join("");
  return { d, min, max, x, y };
}

/** Jendela grafik kecil menurut frekuensi: tahunan semua, kuartalan 5 tahun, bulanan 5 tahun, harian 1 tahun. */
const JENDELA: Record<string, number> = { A: 0, Q: 20, M: 60, D: 260 };

export function GarisKecil({
  titik,
  frekuensi,
  keterangan = true,
}: {
  titik: Titik[];
  frekuensi: string;
  keterangan?: boolean;
}) {
  const n = JENDELA[frekuensi] ?? 60;
  const potong = n ? titik.slice(-n) : titik;
  if (potong.length < 2) return null;
  const { d } = jalur(jarangkan(potong, 130), 120, 28, 0, 2);
  return (
    <figure className="garis-kecil">
      <svg viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={d} />
      </svg>
      {keterangan && (
        <figcaption>
          {periode(potong[0][0])} sampai {periode(potong[potong.length - 1][0])}
        </figcaption>
      )}
    </figure>
  );
}

/** Posisi bidang grafik riwayat di dalam gambar, juga dipakai penunjuk di RiwayatInteraktif. */
export const POSISI_RIWAYAT = { lebarGambar: 640, kiri: 64, lebar: 564 };

/** `sorot` adalah urutan titik yang sedang dipilih penggeser. */
export function GrafikRiwayat({
  titik,
  nama,
  konsep,
  sorot,
}: {
  titik: Titik[];
  nama: string;
  konsep: string;
  sorot?: number;
}) {
  if (titik.length < 2) return <p>Riwayat belum cukup untuk digambar.</p>;
  const { lebarGambar: W, kiri, lebar } = POSISI_RIWAYAT;
  const H = 260;
  const atas = 12;
  const tinggi = H - atas - 32;
  const data = jarangkan(titik, 700);
  const { d, min, max, x, y } = jalur(data, lebar, tinggi, kiri, atas);
  const des = desimalUntuk(max, konsep);
  const besar = Math.abs(max) >= 1e12;
  const label = (v: number) => (besar ? `${angka(v / 1e12, 0)} T` : angka(v, des));
  const iMin = titik.reduce((a, t, i) => (t[1] < titik[a][1] ? i : a), 0);
  const iMax = titik.reduce((a, t, i) => (t[1] > titik[a][1] ? i : a), 0);
  const awal = titik[0][0];
  const akhir = titik[titik.length - 1][0];
  const alt =
    `Grafik ${nama} dari ${periode(awal)} sampai ${periode(akhir)}. ` +
    `Terendah ${label(titik[iMin][1])} pada ${periode(titik[iMin][0])}, ` +
    `tertinggi ${label(titik[iMax][1])} pada ${periode(titik[iMax][0])}.`;
  const garisNol = min < 0 && max > 0 ? y(0) : null;
  // Label 0 dilewati bila menimpa label nilai terendah atau tertinggi.
  const labelNol = garisNol != null && garisNol - atas > 16 && atas + tinggi - garisNol > 16;
  return (
    <svg className="grafik-riwayat grafik-lebar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt}>
      <line x1={kiri} x2={kiri + lebar} y1={atas} y2={atas} className="kisi" />
      <line x1={kiri} x2={kiri + lebar} y1={atas + tinggi} y2={atas + tinggi} className="kisi" />
      {garisNol != null && (
        <line x1={kiri} x2={kiri + lebar} y1={garisNol} y2={garisNol} className="kisi-nol" />
      )}
      <text x={kiri - 8} y={atas + 4} textAnchor="end" className="sumbu">{label(max)}</text>
      <text x={kiri - 8} y={atas + tinggi + 4} textAnchor="end" className="sumbu">{label(min)}</text>
      {labelNol && (
        <text x={kiri - 8} y={garisNol + 4} textAnchor="end" className="sumbu">0</text>
      )}
      <text x={kiri} y={H - 8} className="sumbu">{periode(awal)}</text>
      <text x={kiri + lebar} y={H - 8} textAnchor="end" className="sumbu">{periode(akhir)}</text>
      <path d={d} className="garis" />
      {sorot != null && data[sorot] && (
        <>
          <line x1={x(sorot)} x2={x(sorot)} y1={atas} y2={atas + tinggi} className="sorot-garis" />
          <circle cx={x(sorot)} cy={y(data[sorot][1])} r="5" className="sorot-titik" />
        </>
      )}
    </svg>
  );
}

/**
 * Satu panel kecil per kelompok dengan skala yang sama, supaya besar geraknya bisa dibandingkan.
 * Garis ketiga kelompok sering bersilangan, jadi tidak digambar dalam satu bidang.
 */
export function GrafikKelompok({ kelompok }: { kelompok: { nama: string; titik: Titik[] }[] }) {
  const isi = kelompok.filter((k) => k.titik.length >= 2);
  if (!isi.length) return <p>Riwayat belum cukup untuk digambar.</p>;
  const W = 320;
  const H = 150;
  const kiri = 44;
  const atas = 10;
  const lebar = W - kiri - 44;
  const tinggi = H - atas - 24;
  const nilai = isi.flatMap((k) => k.titik.map((t) => t[1]));
  const min = Math.min(0, ...nilai);
  const max = Math.max(0, ...nilai);
  const y = (v: number) => atas + tinggi - ((v - min) / (max - min || 1)) * tinggi;
  const persen = (v: number) => `${angka(v, 1)}%`;
  return (
    <div className="kisi-kelompok">
      {isi.map(({ nama, titik }) => {
        const x = (i: number) => kiri + (i * lebar) / (titik.length - 1);
        const akhir = titik[titik.length - 1];
        const rendah = titik.reduce((a, t) => (t[1] < a[1] ? t : a));
        const puncak = titik.reduce((a, t) => (t[1] > a[1] ? t : a));
        const alt =
          `Grafik ${nama}, dibanding bulan yang sama tahun sebelumnya, ${periode(titik[0][0])} sampai ${periode(akhir[0])}. ` +
          `Terendah ${persen(rendah[1])} pada ${periode(rendah[0])}, tertinggi ${persen(puncak[1])} pada ${periode(puncak[0])}, ` +
          `terakhir ${persen(akhir[1])}.`;
        return (
          <figure key={nama} className="grafik-kelompok">
            <figcaption>{nama}</figcaption>
            <svg className="grafik-riwayat" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt}>
              <line x1={kiri} x2={kiri + lebar} y1={y(max)} y2={y(max)} className="kisi" />
              <line x1={kiri} x2={kiri + lebar} y1={y(min)} y2={y(min)} className="kisi" />
              <line x1={kiri} x2={kiri + lebar} y1={y(0)} y2={y(0)} className="kisi-nol" />
              {max > 0 && <text x={kiri - 6} y={y(max) + 4} textAnchor="end" className="sumbu">{persen(max)}</text>}
              {min < 0 && <text x={kiri - 6} y={y(min) + 4} textAnchor="end" className="sumbu">{persen(min)}</text>}
              <text x={kiri - 6} y={y(0) + 4} textAnchor="end" className="sumbu">0</text>
              <text x={kiri} y={H - 6} className="sumbu">{periode(titik[0][0])}</text>
              <text x={kiri + lebar} y={H - 6} textAnchor="end" className="sumbu">{periode(akhir[0])}</text>
              <path
                d={titik.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(t[1]).toFixed(1)}`).join("")}
                className="garis"
              />
              <circle cx={x(titik.length - 1)} cy={y(akhir[1])} r={4} className="titik-akhir" />
              <text x={kiri + lebar + 8} y={y(akhir[1]) + 4} className="sumbu-nilai">{persen(akhir[1])}</text>
            </svg>
          </figure>
        );
      })}
    </div>
  );
}

/** Waktu sebagai jumlah bulan, supaya jarak antarronde TPT yang tidak rata tetap benar di sumbu. */
function bulanKe(p: string): number {
  const q = /^(\d{4})-Q([1-4])$/.exec(p);
  if (q) return Number(q[1]) * 12 + Number(q[2]) * 3 - 1;
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m) return Number(m[1]) * 12 + Number(m[2]) - 1;
  return Number(p) * 12 + 11;
}

export type TitikPerkiraan = { periode: string; titik: number; bawah: number | null; atas: number | null };

/**
 * Riwayat resmi (garis utuh), perkiraan (putus-putus), dan pita rentang 80%. Lebar gambarnya 360 supaya
 * teksnya tetap terbaca di HP dan di kartu tiga kolom.
 */
export function GrafikPerkiraan({
  riwayat,
  ramalan,
  nama,
  desimal,
}: {
  riwayat: Titik[];
  ramalan: TitikPerkiraan[];
  nama: string;
  desimal: number;
}) {
  if (riwayat.length < 2 || !ramalan.length) return <p>Riwayat belum cukup untuk digambar.</p>;
  const W = 360;
  const H = 230;
  const kiri = 44;
  const kanan = 54;
  const atas = 26;
  const bawah = 26;
  const lebar = W - kiri - kanan;
  const tinggi = H - atas - bawah;
  const terakhir = riwayat[riwayat.length - 1];
  const nilai = [
    ...riwayat.map((t) => t[1]),
    ...ramalan.flatMap((r) => [r.titik, r.bawah, r.atas].filter((v): v is number => v != null)),
  ];
  const min = Math.min(...nilai);
  const max = Math.max(...nilai);
  const rentang = max - min || 1;
  const t0 = bulanKe(riwayat[0][0]);
  const t1 = bulanKe(ramalan[ramalan.length - 1].periode);
  const x = (p: string) => kiri + ((bulanKe(p) - t0) / (t1 - t0 || 1)) * lebar;
  const y = (v: number) => atas + tinggi - ((v - min) / rentang) * tinggi;
  const garis = (titik: [string, number][]) =>
    titik.map(([p, v], i) => `${i ? "L" : "M"}${x(p).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const berpita = ramalan.filter((r) => r.bawah != null && r.atas != null);
  const pita = berpita.length
    ? `M${x(terakhir[0]).toFixed(1)} ${y(terakhir[1]).toFixed(1)}` +
      berpita.map((r) => `L${x(r.periode).toFixed(1)} ${y(r.atas!).toFixed(1)}`).join("") +
      [...berpita].reverse().map((r) => `L${x(r.periode).toFixed(1)} ${y(r.bawah!).toFixed(1)}`).join("") +
      "Z"
    : null;
  const akhir = ramalan[ramalan.length - 1];
  const teks = (v: number) => `${angka(v, desimal)}%`;
  const alt =
    `Grafik ${nama}. Angka resmi sampai ${periode(terakhir[0])} sebesar ${teks(terakhir[1])}. ` +
    `Perkiraan sampai ${periode(akhir.periode)} sebesar ${teks(akhir.titik)}` +
    (akhir.bawah != null && akhir.atas != null
      ? `, dengan rentang 80% dari ${teks(akhir.bawah)} sampai ${teks(akhir.atas)}.`
      : ".");
  const xBatas = x(terakhir[0]);
  return (
    <svg className="grafik-riwayat" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt}>
      <line x1={kiri} x2={kiri + lebar} y1={atas} y2={atas} className="kisi" />
      <line x1={kiri} x2={kiri + lebar} y1={atas + tinggi} y2={atas + tinggi} className="kisi" />
      <text x={kiri - 6} y={atas + 4} textAnchor="end" className="sumbu">{angka(max, 1)}%</text>
      <text x={kiri - 6} y={atas + tinggi + 4} textAnchor="end" className="sumbu">{angka(min, 1)}%</text>
      <line x1={xBatas} x2={xBatas} y1={atas} y2={atas + tinggi} className="batas-resmi" />
      <text x={xBatas - 5} y={atas - 9} textAnchor="end" className="sumbu">Resmi</text>
      <text x={xBatas + 5} y={atas - 9} className="sumbu">Perkiraan</text>
      {pita && <path d={pita} className="pita-rentang" />}
      <path d={garis(riwayat)} className="garis" />
      <path
        d={garis([terakhir, ...ramalan.map((r): [string, number] => [r.periode, r.titik])])}
        className="garis garis-putus"
      />
      <circle cx={x(akhir.periode)} cy={y(akhir.titik)} r={4} className="titik-akhir" />
      <text x={x(akhir.periode) + 8} y={y(akhir.titik) + 4} className="sumbu-nilai">{teks(akhir.titik)}</text>
      <text x={kiri} y={H - 6} className="sumbu">{periode(riwayat[0][0])}</text>
      <text x={kiri + lebar} y={H - 6} textAnchor="end" className="sumbu">{periode(akhir.periode)}</text>
    </svg>
  );
}

/** Pertumbuhan tahunan resmi, proyeksi IMF (putus-putus), dan target RPJMN sebagai titik berongga. */
export function GrafikJangkaPanjang({
  resmi,
  imf,
  target,
}: {
  resmi: Titik[];
  imf: Titik[];
  target: Titik[];
}) {
  if (resmi.length < 2 || !imf.length) return <p>Riwayat belum cukup untuk digambar.</p>;
  const W = 420;
  const H = 240;
  const kiri = 44;
  const kanan = 96;
  const atas = 14;
  const bawah = 26;
  const lebar = W - kiri - kanan;
  const tinggi = H - atas - bawah;
  const semua = [...resmi, ...imf, ...target];
  const nilai = semua.map((t) => t[1]);
  const min = Math.min(0, ...nilai);
  const max = Math.max(...nilai);
  const t0 = Number(resmi[0][0]);
  const t1 = Number(imf[imf.length - 1][0]);
  const x = (p: string) => kiri + ((Number(p) - t0) / (t1 - t0 || 1)) * lebar;
  const y = (v: number) => atas + tinggi - ((v - min) / (max - min || 1)) * tinggi;
  const garis = (titik: Titik[]) =>
    titik.map(([p, v], i) => `${i ? "L" : "M"}${x(p).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const akhirResmi = resmi[resmi.length - 1];
  const akhirImf = imf[imf.length - 1];
  const akhirTarget = target[target.length - 1];
  const teks = (v: number) => `${angka(v, 1)}%`;
  const alt =
    `Grafik pertumbuhan ekonomi tahunan. Angka resmi sampai ${akhirResmi[0]} sebesar ${teks(akhirResmi[1])}. ` +
    `Proyeksi IMF sampai ${akhirImf[0]} sebesar ${teks(akhirImf[1])}.` +
    (akhirTarget ? ` Target RPJMN ${akhirTarget[0]} sebesar ${teks(akhirTarget[1])}.` : "");
  return (
    <svg className="grafik-riwayat grafik-sedang" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt}>
      <line x1={kiri} x2={kiri + lebar} y1={atas} y2={atas} className="kisi" />
      <line x1={kiri} x2={kiri + lebar} y1={y(min)} y2={y(min)} className="kisi" />
      <line x1={kiri} x2={kiri + lebar} y1={y(0)} y2={y(0)} className="kisi-nol" />
      <text x={kiri - 6} y={atas + 4} textAnchor="end" className="sumbu">{angka(max, 1)}%</text>
      {min < 0 && <text x={kiri - 6} y={y(min) + 4} textAnchor="end" className="sumbu">{angka(min, 1)}%</text>}
      <text x={kiri - 6} y={y(0) + 4} textAnchor="end" className="sumbu">0</text>
      <path d={garis(resmi)} className="garis" />
      <path d={garis([akhirResmi, ...imf])} className="garis garis-putus" />
      {target.map(([p, v]) => (
        <circle key={p} cx={x(p)} cy={y(v)} r={4.5} className="target-titik" />
      ))}
      <text x={x(akhirImf[0]) + 8} y={y(akhirImf[1]) + 4} className="sumbu-nilai">IMF {teks(akhirImf[1])}</text>
      {akhirTarget && (
        <text x={x(akhirTarget[0]) + 9} y={y(akhirTarget[1]) + 4} className="sumbu-nilai">
          RPJMN {teks(akhirTarget[1])}
        </text>
      )}
      <text x={kiri} y={H - 6} className="sumbu">{resmi[0][0]}</text>
      <text x={kiri + lebar} y={H - 6} textAnchor="end" className="sumbu">{akhirImf[0]}</text>
    </svg>
  );
}

/** Satu garis per bulan survei, karena ronde yang berbeda bulan tidak sepadan (PRD 4.4). */
export function GrafikRonde({ titik, nama }: { titik: Titik[]; nama: string }) {
  if (titik.length < 2) return <p>Riwayat belum cukup untuk digambar.</p>;
  const W = 640;
  const H = 260;
  const kiri = 56;
  const atas = 12;
  const lebar = W - kiri - 104;
  const tinggi = H - atas - 32;
  const tahun = (p: string) => Number(p.slice(0, 4));
  const awal = tahun(titik[0][0]);
  const akhir = tahun(titik[titik.length - 1][0]);
  const nilai = titik.map((t) => t[1]);
  const min = Math.min(...nilai);
  const max = Math.max(...nilai);
  const x = (p: string) => kiri + (akhir > awal ? ((tahun(p) - awal) / (akhir - awal)) * lebar : lebar / 2);
  const y = (v: number) => atas + tinggi - ((v - min) / (max - min || 1)) * tinggi;
  const garis = [...new Set(titik.map(([p]) => p.slice(5)))].sort().map((bulan) => {
    const isi = titik.filter(([p]) => p.slice(5) === bulan);
    return { isi, terakhir: isi[isi.length - 1], nama: periode(isi[0][0]).split(" ")[0] };
  });
  const alt =
    `Grafik ${nama}, satu garis per bulan survei, ${awal} sampai ${akhir}. ` +
    garis.map((g) => `${g.nama} ${tahun(g.terakhir[0])}: ${angka(g.terakhir[1], 2)}%.`).join(" ");
  return (
    <svg className="grafik-riwayat grafik-ronde" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt}>
      <line x1={kiri} x2={kiri + lebar} y1={atas} y2={atas} className="kisi" />
      <line x1={kiri} x2={kiri + lebar} y1={atas + tinggi} y2={atas + tinggi} className="kisi" />
      <text x={kiri - 8} y={atas + 4} textAnchor="end" className="sumbu">{angka(max, 1)}%</text>
      <text x={kiri - 8} y={atas + tinggi + 4} textAnchor="end" className="sumbu">{angka(min, 1)}%</text>
      <text x={kiri} y={H - 8} className="sumbu">{awal}</text>
      <text x={kiri + lebar} y={H - 8} textAnchor="end" className="sumbu">{akhir}</text>
      {garis.map((g, i) => (
        <g key={g.nama}>
          <path
            d={g.isi.map(([p, v], j) => `${j ? "L" : "M"}${x(p).toFixed(1)} ${y(v).toFixed(1)}`).join("")}
            className={i ? "garis garis-putus" : "garis"}
          />
          <text x={x(g.terakhir[0]) + 8} y={y(g.terakhir[1]) + 4} className="sumbu">
            {g.nama} {angka(g.terakhir[1], 2)}%
          </text>
        </g>
      ))}
    </svg>
  );
}
