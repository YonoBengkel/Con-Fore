// Segitiga keseimbangan sebagai SVG. Setiap sudut satu dimensi; titik makin ke luar makin baik.
// Teks alternatifnya adalah kalimat ringkasan (aria-labelledby), bukan deskripsi bentuk.

import { NAMA_STATUS, type Dimensi, type Skor, type Status } from "@/lib/skor";

const C = { x: 160, y: 168 };
const R = 116;
const SUDUT = {
  pertumbuhan: -90,
  kerja: 30,
  harga: 150,
} as const;

function titik(sudut: number, jarak: number) {
  const rad = (sudut * Math.PI) / 180;
  return { x: C.x + jarak * Math.cos(rad), y: C.y + jarak * Math.sin(rad) };
}

function poligon(skala: Skor | number): string {
  return (Object.keys(SUDUT) as (keyof typeof SUDUT)[])
    .map((k) => {
      const s = typeof skala === "number" ? skala : skala[k];
      const p = titik(SUDUT[k], (R * Math.max(0, Math.min(100, s))) / 100);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

const LABEL: { kunci: keyof typeof SUDUT; teks: string; x: number; y: number; anchor: "middle" | "start" | "end" }[] = [
  { kunci: "pertumbuhan", teks: "Pertumbuhan", x: 160, y: 22, anchor: "middle" },
  { kunci: "kerja", teks: "Lapangan kerja", x: 314, y: 254, anchor: "end" },
  { kunci: "harga", teks: "Harga stabil", x: 6, y: 254, anchor: "start" },
];

/**
 * `pembanding` diisi skor tahun resmi di tab Prediksi. Saat itu `skor` adalah perkiraan, jadi garisnya
 * putus-putus, dan garis tipis menunjukkan tahun resmi. Skor di sudut selalu milik `skor`.
 */
export function Segitiga({ skor, labelId, pembanding }: { skor: Skor; labelId: string; pembanding?: Skor }) {
  return (
    <svg className="segitiga" viewBox="0 0 320 290" role="img" aria-labelledby={labelId}>
      {[25, 50, 75, 100].map((s) => (
        <polygon key={s} points={poligon(s)} className={s === 100 ? "tri-batas" : "tri-kisi"} />
      ))}
      {(Object.keys(SUDUT) as (keyof typeof SUDUT)[]).map((k) => {
        const ujung = titik(SUDUT[k], R);
        return <line key={k} x1={C.x} y1={C.y} x2={ujung.x} y2={ujung.y} className="tri-kisi" />;
      })}
      {pembanding && <polygon points={poligon(pembanding)} className="tri-pembanding" />}
      <polygon points={poligon(skor)} className={pembanding ? "tri-isi tri-perkiraan" : "tri-isi"} />
      {(Object.keys(SUDUT) as (keyof typeof SUDUT)[]).map((k) => {
        const p = titik(SUDUT[k], (R * Math.max(0, Math.min(100, skor[k]))) / 100);
        return <circle key={k} cx={p.x} cy={p.y} r={4} className="tri-titik" />;
      })}
      {LABEL.map((l) => (
        <text key={l.kunci} x={l.x} y={l.y} textAnchor={l.anchor} className="tri-label" aria-hidden="true">
          <tspan x={l.x}>{l.teks}</tspan>
          <tspan x={l.x} dy="18" className="tri-skor">
            {Math.round(skor[l.kunci])}
          </tspan>
        </text>
      ))}
    </svg>
  );
}

const URUTAN_STATUS: { kunci: Dimensi; teks: string }[] = [
  { kunci: "pertumbuhan", teks: "Pertumbuhan" },
  { kunci: "harga", teks: "Harga stabil" },
  { kunci: "kerja", teks: "Lapangan kerja" },
];

/** Lingkaran kosong, setengah, atau penuh. Disembunyikan dari pembaca layar: katanya sudah tertulis. */
function IkonStatus({ status }: { status: Status }) {
  return (
    <svg className="tingkat-ikon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="5" fill={status === "berat" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
      {status === "waspada" && <path d="M6 1a5 5 0 0 1 0 10z" fill="currentColor" />}
    </svg>
  );
}

/** Skor dan status tiap dimensi (PRD 4.4), dengan urutan yang sama seperti kalimat ringkasan. */
export function DaftarStatus({ skor, status }: { skor: Skor; status: Record<Dimensi, Status> }) {
  return (
    <ul className="status-dimensi">
      {URUTAN_STATUS.map(({ kunci, teks }) => (
        <li key={kunci}>
          <span>
            {teks} <span className="status-skor">{Math.round(skor[kunci])}</span>
          </span>
          <span className={`tingkat tingkat-${status[kunci]}`}>
            <IkonStatus status={status[kunci]} />
            {NAMA_STATUS[status[kunci]]}
          </span>
        </li>
      ))}
    </ul>
  );
}
