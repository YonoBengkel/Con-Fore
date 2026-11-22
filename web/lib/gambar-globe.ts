// Menggambar globe halaman depan di kanvas dengan proyeksi ortografis d3-geo (DESIGN.md, Halaman depan dan globe).
// Modul ini dimuat lewat import() dari components/Globe.tsx sesudah halaman tampil, jadi kode dan data petanya hanya
// diunduh di halaman depan. Warnanya dibaca dari token di app/globals.css.

import { geoGraticule10, geoOrthographic, geoPath, type GeoObjek, type Titik } from "d3-geo";
import dunia from "world-atlas/countries-110m.json";
import { type Mode, kenaIndonesia, langkahAngkat, pilihMode, putar, selisihSudut, siapkanData } from "./globe.ts";

export { pilihMode };

/** Jarak bola dari tepi kanvas, untuk Indonesia yang terangkat dan bayangannya. Sama dengan `inset` .globe::before. */
const TEPI = 8;
/** Indonesia terangkat 3 px dengan bayangan kabur 6 px dalam 150 ms, umpan balik kursor (DESIGN.md, Gerak). */
const ANGKAT = 3;
const KABUR = 6;
const DURASI_ANGKAT = 150;
/** Globe berputar menghadap Indonesia dalam 400 ms saat tautan namanya disorot, dan berhenti bila sorotannya lepas. */
const DURASI_HADAP = 400;
/** Toleransi sentuh dalam piksel, lebih longgar untuk jari daripada untuk kursor. Jenis input klik dibaca dari pointerdown. */
const TOLERANSI_KURSOR = 3;
const TOLERANSI_JARI = 10;
/** Mouse yang ditekan lalu dilepas lebih jauh dari ini sedang menyeret, bukan memilih negara. */
const GESER_KLIK_MAKS = 5;

export type PengaturGlobe = {
  /** Menghentikan putaran, atau melanjutkannya dari posisi terakhir (tombol henti, WCAG 2.2.2). */
  aturPutar(ya: boolean): void;
  /** Tautan nama Indonesia disorot kursor atau fokus: globe berhenti, menghadap Indonesia, dan Indonesia terangkat. */
  sorotTautan(ya: boolean): void;
  lepas(): void;
};

const melambat = (t: number) => 1 - (1 - t) ** 3;
const halus = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** `keIndonesia(true)` berarti halaman Indonesia dibuka di tab baru. */
export function pasangGlobe(
  kanvas: HTMLCanvasElement,
  mode: Mode,
  kurangiGerak: boolean,
  keIndonesia: (tabBaru: boolean) => void,
): PengaturGlobe {
  const konteks = kanvas.getContext("2d");
  if (!konteks) throw new Error("Kanvas 2D tidak tersedia");
  const ctx: CanvasRenderingContext2D = konteks;
  const data = siapkanData(dunia);
  const gaya = getComputedStyle(kanvas);
  const token = (nama: string) => gaya.getPropertyValue(nama).trim();
  const warna = {
    bola: token("--permukaan"),
    garis: token("--garis"),
    darat: token("--darat"),
    indonesia: token("--tinta"),
    bayang: token("--bayang-angkat"),
  };
  const proyeksi = geoOrthographic().rotate([-data.pusat[0], -data.pusat[1]]);
  const jalur = geoPath(proyeksi, ctx);
  const bola = { type: "Sphere" };
  const garisLintangBujur = geoGraticule10();
  const durasiAngkat = kurangiGerak ? 0 : DURASI_ANGKAT;

  let lebar = 0;
  let rasio = 1;
  let bolehPutar = mode.berputar;
  let kursorDiBola = false;
  let kursorDiIndonesia = false;
  let tautanDisorot = false;
  let terlihat = true;
  let angkat = mode.angkatAwal ? 1 : 0;
  let hadap: { dari: number; selisih: number; mulai: number } | null = null;
  let idBingkai = 0;
  let waktuLalu = 0;
  let dilepas = false;
  let tekan: { x: number; y: number; jari: boolean } | null = null;
  let kueriRasio: MediaQueryList | null = null;

  const naik = () => mode.angkatAwal || kursorDiIndonesia || tautanDisorot;
  const sedangBerputar = () => bolehPutar && !kursorDiBola && !tautanDisorot && terlihat;

  function ukur() {
    lebar = kanvas.clientWidth;
    rasio = Math.min(window.devicePixelRatio || 1, 2);
    kanvas.width = Math.round(lebar * rasio);
    kanvas.height = Math.round(lebar * rasio);
    proyeksi.translate([lebar / 2, lebar / 2]).scale(Math.max(lebar / 2 - TEPI, 1));
  }

  function isi(objek: GeoObjek, warnaIsi: string) {
    ctx.beginPath();
    jalur(objek);
    ctx.fillStyle = warnaIsi;
    ctx.fill();
  }

  function garis(objek: GeoObjek, warnaGaris: string) {
    ctx.beginPath();
    jalur(objek);
    ctx.strokeStyle = warnaGaris;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  function gambar() {
    const a = melambat(angkat);
    ctx.setTransform(rasio, 0, 0, rasio, 0, 0);
    ctx.clearRect(0, 0, lebar, lebar);
    isi(bola, warna.bola);
    garis(garisLintangBujur, warna.garis);
    isi(data.lainnya, warna.darat);
    garis(data.batas, warna.bola);
    // Indonesia digambar terakhir, naik beberapa piksel dengan bayangan di tempat asalnya. Ukuran bayangan
    // kanvas tidak ikut skala setTransform, jadi dikali rasio piksel.
    ctx.save();
    if (a > 0) {
      ctx.shadowColor = warna.bayang;
      ctx.shadowBlur = KABUR * a * rasio;
      ctx.shadowOffsetY = ANGKAT * a * rasio;
    }
    ctx.translate(0, -ANGKAT * a);
    isi(data.indonesia, warna.indonesia);
    ctx.restore();
  }

  function bingkai(waktu: number) {
    idBingkai = 0;
    const selang = waktuLalu ? waktu - waktuLalu : 0;
    waktuLalu = waktu;
    const [sudut, miring] = proyeksi.rotate();
    if (hadap) {
      const t = Math.min(1, (waktu - hadap.mulai) / DURASI_HADAP);
      proyeksi.rotate([hadap.dari + hadap.selisih * halus(Math.max(t, 0)), miring]);
      if (t >= 1) hadap = null;
    } else if (sedangBerputar()) {
      proyeksi.rotate([putar(sudut, selang), miring]);
    }
    angkat = langkahAngkat(angkat, naik(), selang, durasiAngkat);
    gambar();
    if (hadap || sedangBerputar() || angkat !== (naik() ? 1 : 0)) minta();
    else waktuLalu = 0;
  }

  function minta() {
    if (!dilepas && !idBingkai) idBingkai = requestAnimationFrame(bingkai);
  }

  function titikDari(e: MouseEvent): Titik {
    const kotak = kanvas.getBoundingClientRect();
    return [e.clientX - kotak.left, e.clientY - kotak.top];
  }

  /** Titik layar ke [bujur, lintang], atau null di luar bola. Cek cakram ini wajib, karena invert ortografis d3 tidak
   *  pernah null: titik di luar bola dipetakan ke tepinya. */
  function kebalikan([x, y]: Titik): Titik | null {
    const [cx, cy] = proyeksi.translate();
    const r = proyeksi.scale();
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return null;
    return proyeksi.invert([x, y]);
  }

  /** Uji kena di posisi dasar dan posisi terangkat Indonesia, karena saat terangkat Indonesia digambar lebih tinggi. */
  function diIndonesia(e: MouseEvent, toleransi: number) {
    return kenaIndonesia(data, kebalikan, titikDari(e), toleransi, ANGKAT * melambat(angkat));
  }

  /** Sentuhan diabaikan di sini, supaya ketukan di laptop layar sentuh tidak menimpa status mouse. */
  function saatGerak(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    kursorDiBola = kebalikan(titikDari(e)) !== null;
    kursorDiIndonesia = kursorDiBola && diIndonesia(e, TOLERANSI_KURSOR);
    kanvas.style.cursor = kursorDiIndonesia ? "pointer" : "";
    minta();
  }

  function saatKeluar(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    kursorDiBola = false;
    kursorDiIndonesia = false;
    kanvas.style.cursor = "";
    minta();
  }

  function saatTekan(e: PointerEvent) {
    tekan = { x: e.clientX, y: e.clientY, jari: e.pointerType !== "mouse" };
  }

  function saatKlik(e: MouseEvent) {
    const awal = tekan;
    tekan = null;
    // Ketukan jari sudah disaring browser. Untuk mouse, tekan di satu tempat lalu lepas di tempat lain adalah seretan.
    if (awal && !awal.jari && Math.hypot(e.clientX - awal.x, e.clientY - awal.y) > GESER_KLIK_MAKS) return;
    const jari = awal ? awal.jari : mode.angkatAwal;
    // Seperti tautan biasa, Ctrl, Cmd, atau Shift dengan klik, dan klik tengah, membuka tab baru.
    if (diIndonesia(e, jari ? TOLERANSI_JARI : TOLERANSI_KURSOR)) {
      keIndonesia(e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey);
    }
  }

  /** Klik tengah tidak mengirim event click, hanya auxclick. */
  function saatKlikLain(e: MouseEvent) {
    if (e.button === 1) saatKlik(e);
  }

  /** Di Windows, klik tengah di halaman yang bisa digulir memulai gulir otomatis. Di atas Indonesia klik tengah
   *  membuka tab baru, jadi gulir otomatis dicegah di sana saja. */
  function saatTekanMouse(e: MouseEvent) {
    if (e.button === 1 && diIndonesia(e, TOLERANSI_KURSOR)) e.preventDefault();
  }

  /** Zoom browser dan pindah monitor mengubah rasio piksel tanpa mengubah ukuran CSS kanvas, jadi ResizeObserver
   *  tidak terpanggil. Kueri resolusi ini menangkapnya, lalu dipasang ulang untuk rasio yang baru. */
  function pantauRasio() {
    kueriRasio?.removeEventListener("change", saatRasioBerubah);
    kueriRasio = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    kueriRasio.addEventListener("change", saatRasioBerubah);
  }

  function saatRasioBerubah() {
    ukur();
    gambar();
    pantauRasio();
  }

  kanvas.addEventListener("pointerdown", saatTekan);
  kanvas.addEventListener("pointermove", saatGerak);
  kanvas.addEventListener("pointerleave", saatKeluar);
  kanvas.addEventListener("click", saatKlik);
  kanvas.addEventListener("auxclick", saatKlikLain);
  kanvas.addEventListener("mousedown", saatTekanMouse);
  // Konteks 2D bisa hilang lalu pulih dalam keadaan kosong, misalnya saat GPU dimulai ulang.
  kanvas.addEventListener("contextrestored", gambar);
  pantauRasio();
  const amatiUkuran = new ResizeObserver(() => {
    ukur();
    gambar();
  });
  amatiUkuran.observe(kanvas);
  // Satu panggilan bisa membawa beberapa entri untuk kanvas yang sama bila keadaannya berubah dua kali sebelum
  // callback jalan. Yang berlaku entri terakhir. Kalau yang dibaca entri pertama, globe bisa diam selamanya.
  const amatiLayar = new IntersectionObserver((isian) => {
    terlihat = isian[isian.length - 1].isIntersecting;
    minta();
  });
  amatiLayar.observe(kanvas);

  ukur();
  gambar();
  minta();

  return {
    aturPutar(ya) {
      bolehPutar = mode.berputar && ya;
      minta();
    },
    sorotTautan(ya) {
      tautanDisorot = ya;
      hadap = null;
      if (ya) {
        const [sudut, miring] = proyeksi.rotate();
        const tujuan = -data.pusat[0];
        const selisih = selisihSudut(sudut, tujuan);
        if (kurangiGerak) proyeksi.rotate([tujuan, miring]);
        else if (Math.abs(selisih) > 0.5) hadap = { dari: sudut, selisih, mulai: performance.now() };
      }
      minta();
    },
    lepas() {
      dilepas = true;
      cancelAnimationFrame(idBingkai);
      idBingkai = 0;
      amatiUkuran.disconnect();
      amatiLayar.disconnect();
      kueriRasio?.removeEventListener("change", saatRasioBerubah);
      kanvas.removeEventListener("pointerdown", saatTekan);
      kanvas.removeEventListener("pointermove", saatGerak);
      kanvas.removeEventListener("pointerleave", saatKeluar);
      kanvas.removeEventListener("click", saatKlik);
      kanvas.removeEventListener("auxclick", saatKlikLain);
      kanvas.removeEventListener("mousedown", saatTekanMouse);
      kanvas.removeEventListener("contextrestored", gambar);
    },
  };
}
