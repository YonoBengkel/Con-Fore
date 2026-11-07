// Latar beranda dan tab Prediksi: kisi segitiga keseimbangan yang dibesarkan sampai menjadi cakrawala.
// Hanya hiasan, murni SVG tanpa JavaScript, dan tidak terbaca pembaca layar.

const C = { x: 800, y: 700 };
const R = 860;
const SUDUT = [-90, 30, 150];

function titik(sudut: number, jarak: number) {
  const rad = (sudut * Math.PI) / 180;
  return { x: C.x + jarak * Math.cos(rad), y: C.y + jarak * Math.sin(rad) };
}

const poligon = (jarak: number) =>
  SUDUT.map((s) => {
    const p = titik(s, jarak);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");

export function Langit() {
  return (
    <div className="langit" aria-hidden="true">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMin slice" focusable="false">
        <defs>
          <radialGradient id="langit-isi" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#16294a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0b1324" stopOpacity="0.4" />
          </radialGradient>
        </defs>
        <polygon points={poligon(R)} fill="url(#langit-isi)" />
        {[0.25, 0.5, 0.75].map((k) => (
          <polygon key={k} points={poligon(R * k)} className="langit-kisi" />
        ))}
        {SUDUT.map((s) => {
          const u = titik(s, R);
          return <line key={s} x1={C.x} y1={C.y} x2={u.x} y2={u.y} className="langit-kisi" />;
        })}
        {[0.25, 0.5, 0.75].flatMap((k) =>
          SUDUT.map((s) => {
            const p = titik(s, R * k);
            return <circle key={`${k}-${s}`} cx={p.x} cy={p.y} r="2.5" className="langit-titik" />;
          }),
        )}
        <polygon points={poligon(R)} className="langit-pijar" />
        <polygon points={poligon(R)} className="langit-tepi" />
      </svg>
    </div>
  );
}
