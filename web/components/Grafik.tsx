// Grafik garis sederhana sebagai SVG, digambar di server (browser hanya menerima SVG jadi).

import type { Titik } from "@/lib/data";
import { angka, desimalUntuk, periode } from "@/lib/format";

/** Ambil paling banyak `maks` titik dengan langkah tetap, titik terakhir selalu ikut. */
function jarangkan(titik: Titik[], maks: number): Titik[] {
  if (titik.length <= maks) return titik;
  const langkah = Math.ceil(titik.length / maks);
  const hasil = titik.filter((_, i) => i % langkah === 0);
  if (hasil[hasil.length - 1] !== titik[titik.length - 1]) hasil.push(titik[titik.length - 1]);
  return hasil;
}

function jalur(titik: Titik[], lebar: number, tinggi: number, kiri = 0, atas = 0) {
  const nilai = titik.map((t) => t[1]);
  const min = Math.min(...nilai);
  const max = Math.max(...nilai);
  const rentang = max - min || 1;
  const x = (i: number) => kiri + (titik.length > 1 ? (i * lebar) / (titik.length - 1) : lebar / 2);
  const y = (v: number) => atas + tinggi - ((v - min) / rentang) * tinggi;
  const d = titik.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(t[1]).toFixed(1)}`).join("");
  return { d, min, max, y };
}

/** Jendela grafik kecil menurut frekuensi: tahunan semua, kuartalan 5 tahun, bulanan 5 tahun, harian 1 tahun. */
const JENDELA: Record<string, number> = { A: 0, Q: 20, M: 60, D: 260 };

export function GarisKecil({ titik, frekuensi }: { titik: Titik[]; frekuensi: string }) {
  const n = JENDELA[frekuensi] ?? 60;
  const potong = n ? titik.slice(-n) : titik;
  if (potong.length < 2) return null;
  const { d } = jalur(jarangkan(potong, 130), 120, 28, 0, 2);
  return (
    <figure className="garis-kecil">
      <svg viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={d} />
      </svg>
      <figcaption>
        {periode(potong[0][0])} sampai {periode(potong[potong.length - 1][0])}
      </figcaption>
    </figure>
  );
}

export function GrafikRiwayat({
  titik,
  nama,
  konsep,
}: {
  titik: Titik[];
  nama: string;
  konsep: string;
}) {
  if (titik.length < 2) return <p>Riwayat belum cukup untuk digambar.</p>;
  const W = 640;
  const H = 260;
  const kiri = 64;
  const atas = 12;
  const lebar = W - kiri - 12;
  const tinggi = H - atas - 32;
  const data = jarangkan(titik, 700);
  const { d, min, max, y } = jalur(data, lebar, tinggi, kiri, atas);
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
  return (
    <svg className="grafik-riwayat" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt}>
      <line x1={kiri} x2={kiri + lebar} y1={atas} y2={atas} className="kisi" />
      <line x1={kiri} x2={kiri + lebar} y1={atas + tinggi} y2={atas + tinggi} className="kisi" />
      {garisNol != null && (
        <line x1={kiri} x2={kiri + lebar} y1={garisNol} y2={garisNol} className="kisi-nol" />
      )}
      <text x={kiri - 8} y={atas + 4} textAnchor="end" className="sumbu">{label(max)}</text>
      <text x={kiri - 8} y={atas + tinggi + 4} textAnchor="end" className="sumbu">{label(min)}</text>
      {garisNol != null && (
        <text x={kiri - 8} y={garisNol + 4} textAnchor="end" className="sumbu">0</text>
      )}
      <text x={kiri} y={H - 8} className="sumbu">{periode(awal)}</text>
      <text x={kiri + lebar} y={H - 8} textAnchor="end" className="sumbu">{periode(akhir)}</text>
      <path d={d} className="garis" />
    </svg>
  );
}
