// Isi satu jawaban (PRD 4.1): kalimat, angka, label, contoh sehari-hari, perbandingan, dan waktu data, dengan
// urutan yang sama di halaman Indonesia dan halaman rinci. Juga ringkasan bercerita di awal halaman Indonesia.

import type { Bagian, Jawaban } from "@/lib/jawaban";

export function IsiJawaban({ j }: { j: Jawaban }) {
  return (
    <>
      <p className="jawaban">{j.kalimat}</p>
      <p className="angka-besar">
        <data value={j.nilai.value}>{j.angka}</data>
      </p>
      <p className="label-angka">
        {j.label}
        {j.nilai.is_stale && <span className="label-basi"> Terlambat diperbarui.</span>}
      </p>
      <p className="contoh">{j.contoh}</p>
      {j.banding.length > 0 && (
        <ul className="banding">
          {j.banding.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {j.waktu && <p className="waktu">{j.waktu}</p>}
    </>
  );
}

export function KalimatCerita({ kalimat }: { kalimat: Bagian[][] }) {
  return (
    <p className="cerita-isi">
      {kalimat.map((bagian, i) => (
        <span key={i}>
          {i > 0 && " "}
          {bagian.map((b, j) =>
            typeof b === "string" ? (
              b
            ) : (
              <b key={j} className="n" data-topik={b.kelas}>
                {b.angka}
              </b>
            ),
          )}
        </span>
      ))}
    </p>
  );
}
