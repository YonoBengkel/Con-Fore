// Rincian khusus di halaman rinci (PRD 4.1 dan 4.4): kelompok harga di Harga, dan porsi pekerja formal di Kerja.

import Link from "next/link";
import type { Grafik } from "@/lib/data";
import { titikSeri } from "@/lib/data";
import { angka, nilaiSeri, periode } from "@/lib/format";
import { KELOMPOK_INFLASI, SERI_FORMAL, SERI_TPT_RONDE } from "@/lib/konten";
import { kalimatPekerja } from "@/lib/pekerja";
import { rincianInflasi } from "@/lib/rincian";
import { GrafikKelompok, GrafikRonde } from "./Grafik";

export function RincianInflasi({ grafik }: { grafik: Map<string, Grafik> }) {
  const rincian = rincianInflasi((s) => titikSeri(grafik, s));
  if (!rincian) return null;
  return (
    <section className="bagian" aria-labelledby="judul-kelompok">
      <h2 id="judul-kelompok">Kelompok harga</h2>
      <p>{rincian.kalimat}</p>
      <div className="gulir-tabel" role="region" aria-labelledby="judul-kelompok" tabIndex={0}>
        <table className="kepala-bungkus">
          <thead>
            <tr>
              <th scope="col">Kelompok</th>
              <th scope="col">Dibanding setahun lalu</th>
              <th scope="col">Dibanding bulan lalu</th>
            </tr>
          </thead>
          <tbody>
            {rincian.baris.map((b) => (
              <tr key={b.nama}>
                <th scope="row">{b.nama}</th>
                <td className="angka">{b.setahun == null ? "-" : nilaiSeri(b.setahun, "%", "yoy")}</td>
                <td className="angka">{b.sebulan == null ? "-" : nilaiSeri(b.sebulan, "%", "rate")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="daftar-kelompok">
        {KELOMPOK_INFLASI.map((k) => (
          <li key={k.setahun}>
            <strong>{k.nama}:</strong> {k.isi}{" "}
            <Link href={`/indikator/${k.setahun}`}>Riwayat {k.nama.toLowerCase()}</Link>
          </li>
        ))}
      </ul>
      <h3>Dibanding bulan yang sama tahun sebelumnya</h3>
      <GrafikKelompok kelompok={KELOMPOK_INFLASI.map((k) => ({ nama: k.nama, titik: titikSeri(grafik, k.setahun) }))} />
      <p className="catatan">
        Skala ketiga grafik sama. Lonjakan harga diatur pemerintah pada awal 2026 dan penurunannya pada awal 2025
        berkaitan dengan diskon tarif listrik 50 persen pada awal 2025, menurut BPS.
      </p>
      <p className="catatan">
        Angka kelompok tidak bisa dijumlahkan menjadi angka umum, karena bobot tiap kelompok berbeda. Angka dibanding
        bulan lalu dan angka umum adalah angka resmi BPS. Angka setahun per kelompok dihitung Con-Fore dari 12
        perubahan bulanan, jadi bisa berbeda sekitar 0,02 poin persen dari angka rilis BPS.
      </p>
    </section>
  );
}

export function RincianPekerja({ grafik }: { grafik: Map<string, Grafik> }) {
  const formal = titikSeri(grafik, SERI_FORMAL);
  const pekerja = kalimatPekerja(formal, titikSeri(grafik, SERI_TPT_RONDE));
  if (!pekerja) return null;
  return (
    <section className="bagian" aria-labelledby="judul-pekerja">
      <h2 id="judul-pekerja">Pekerja formal dan informal</h2>
      <p>
        {pekerja.porsi} {pekerja.hubungan}
      </p>
      <GrafikRonde titik={formal} nama="porsi pekerja formal" />
      <p className="catatan">
        Pekerja formal menurut BPS adalah yang berusaha dibantu buruh tetap dan dibayar, serta buruh, karyawan, atau
        pegawai. Selebihnya informal. Garisnya dipisah per bulan survei, karena porsinya berbeda antara Februari dan
        Agustus.
      </p>
      <div className="gulir-tabel" role="region" aria-labelledby="judul-pekerja" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Survei</th>
              <th scope="col">Formal</th>
              <th scope="col">Informal</th>
            </tr>
          </thead>
          <tbody>
            {formal
              .slice(-6)
              .reverse()
              .map(([p, v]) => (
                <tr key={p}>
                  <th scope="row">{periode(p)}</th>
                  <td className="angka">{angka(v, 2)}%</td>
                  <td className="angka">{angka(100 - v, 2)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p>
        <Link href={`/indikator/${SERI_FORMAL}`}>Riwayat lengkap porsi pekerja formal</Link>
      </p>
    </section>
  );
}
