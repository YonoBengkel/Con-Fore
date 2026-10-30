// Segitiga keseimbangan sebagai SVG. Setiap sudut satu dimensi; titik makin ke luar makin baik.
// Teks alternatifnya adalah kalimat ringkasan (aria-labelledby), bukan deskripsi bentuk.

import type { Skor } from "@/lib/skor";

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

export function Segitiga({ skor, labelId }: { skor: Skor; labelId: string }) {
  return (
    <svg className="segitiga" viewBox="0 0 320 290" role="img" aria-labelledby={labelId}>
      {[25, 50, 75, 100].map((s) => (
        <polygon key={s} points={poligon(s)} className={s === 100 ? "tri-batas" : "tri-kisi"} />
      ))}
      {(Object.keys(SUDUT) as (keyof typeof SUDUT)[]).map((k) => {
        const ujung = titik(SUDUT[k], R);
        return <line key={k} x1={C.x} y1={C.y} x2={ujung.x} y2={ujung.y} className="tri-kisi" />;
      })}
      <polygon points={poligon(skor)} className="tri-isi" />
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
