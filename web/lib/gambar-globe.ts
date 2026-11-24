// Menggambar globe halaman depan di kanvas dengan proyeksi ortografis (DESIGN.md, Halaman depan dan globe).
// Modul ini dimuat lewat import() dari components/Globe.tsx sesudah halaman tampil, jadi kode dan data petanya hanya
// diunduh di halaman depan. Warnanya dibaca dari token di app/globals.css.

import { geoGraticule10, geoOrthographic, type Titik } from "d3-geo";
import dunia from "world-atlas/countries-110m.json";
import {
  type ArahPutar,
  type Hadap,
  type Jejak,
  type Kamera,
  type Laju,
  type Mode,
  hadapKe,
  kenaIndonesia,
  lajuLepas,
  langkahAngkat,
  langkahLempar,
  pasangKamera,
  pilihMode,
  putar,
  selisihSudut,
  seret,
  siapkanData,
  tulisJalur,
  vektorDari,
} from "./globe.ts";

export { pilihMode };

/** Jarak bola dari tepi kanvas, untuk Indonesia yang terangkat dan bayangannya. Sama dengan `inset` .globe::before. */
const TEPI = 8;
/** Indonesia terangkat 3 px dengan bayangan kabur 6 px dalam 150 ms, umpan balik kursor (DESIGN.md, Gerak). */
const ANGKAT = 3;
const KABUR = 6;
const DURASI_ANGKAT = 150;
/** Globe menghadap Indonesia dalam 400 ms saat tautan namanya disorot, dan menghadap titik yang diketuk di HP. */
const DURASI_HADAP = 400;
/** Toleransi sentuh dalam piksel, lebih longgar untuk jari daripada untuk kursor. Jenis input klik dibaca dari pointerdown. */
const TOLERANSI_KURSOR = 3;
const TOLERANSI_JARI = 10;
/** Kursor atau jari yang bergeser lebih jauh dari ini sedang menyeret globe, bukan memilih negara. */
const GESER_KLIK_MAKS = 5;
/** Laju (piksel per detik) yang dihitung sebagai lemparan saat dilepas, dan laju saat lemparan dianggap berhenti. */
const LAJU_LEMPAR = 120;
const LAJU_HENTI = 15;

/** Izin berputar sendiri. Dipegang komponen globe, supaya globe yang dipasang ulang tetap berhenti bila tadinya
 *  dihentikan (WCAG 2.2.2). */
export type Putaran = { boleh: boolean };

export type PengaturGlobe = {
  /** Tautan nama Indonesia disorot kursor atau fokus: globe berhenti, menghadap Indonesia, dan Indonesia terangkat. */
  sorotTautan(ya: boolean): void;
  lepas(): void;
};

/** Penekanan terakhir di kanvas. `aktif` selama bola masih dipegang, `menyeret` sesudah geserannya cukup jauh, dan
 *  `menangkap` bila penekanannya menghentikan globe yang masih melaju, selain di atas Indonesia yang sedang disorot
 *  kursor. */
type Tekan = {
  id: number;
  x: number;
  y: number;
  jari: boolean;
  aktif: boolean;
  menyeret: boolean;
  menangkap: boolean;
  jejak: Jejak[];
};

const melambat = (t: number) => 1 - (1 - t) ** 3;
const halus = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** `keIndonesia(true)` berarti halaman Indonesia dibuka di tab baru. */
export function pasangGlobe(
  kanvas: HTMLCanvasElement,
  mode: Mode,
  kurangiGerak: boolean,
  putaran: Putaran,
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
  const proyeksi = geoOrthographic().rotate(hadapKe(data.pusat));
  const gambaran = {
    kisi: vektorDari(geoGraticule10()),
    lainnya: data.lainnya.features.flatMap((negara) => vektorDari(negara.geometry)),
    batas: vektorDari(data.batas),
    indonesia: vektorDari(data.indonesia.geometry),
  };
  const durasiAngkat = kurangiGerak ? 0 : DURASI_ANGKAT;

  let lebar = 0;
  let rasio = 1;
  let arahPutar: ArahPutar = 1;
  let kursorDiBola = false;
  let kursorDiIndonesia = false;
  let tautanDisorot = false;
  let terlihat = true;
  let angkat = mode.angkatAwal ? 1 : 0;
  let hadap: { dari: Hadap; selisih: Hadap; mulai: number } | null = null;
  let lempar: Laju | null = null;
  let idBingkai = 0;
  let waktuLalu = 0;
  let dilepas = false;
  let tekan: Tekan | null = null;
  let kueriRasio: MediaQueryList | null = null;

  const naik = () => mode.angkatAwal || kursorDiIndonesia || tautanDisorot;
  const sedangBerputar = () =>
    mode.berputar && putaran.boleh && !kursorDiBola && !tautanDisorot && !tekan?.aktif && terlihat;
  const arahHadap = (): Hadap => {
    const [sudut, miring] = proyeksi.rotate();
    return [sudut, miring];
  };

  function ukur() {
    lebar = kanvas.clientWidth;
    rasio = Math.min(window.devicePixelRatio || 1, 2);
    kanvas.width = Math.round(lebar * rasio);
    kanvas.height = Math.round(lebar * rasio);
    proyeksi.translate([lebar / 2, lebar / 2]).scale(Math.max(lebar / 2 - TEPI, 1));
  }

  function isi(cincin: Float64Array[], kamera: Kamera, warnaIsi: string) {
    ctx.beginPath();
    for (const vektor of cincin) tulisJalur(ctx, vektor, kamera, true);
    ctx.fillStyle = warnaIsi;
    ctx.fill();
  }

  function garis(daftar: Float64Array[], kamera: Kamera, warnaGaris: string) {
    ctx.beginPath();
    for (const vektor of daftar) tulisJalur(ctx, vektor, kamera, false);
    ctx.strokeStyle = warnaGaris;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  function gambar() {
    const a = melambat(angkat);
    const kamera = pasangKamera(arahHadap(), lebar / 2, proyeksi.scale());
    ctx.setTransform(rasio, 0, 0, rasio, 0, 0);
    ctx.clearRect(0, 0, lebar, lebar);
    ctx.beginPath();
    ctx.arc(kamera.pusat, kamera.pusat, kamera.jejari, 0, 2 * Math.PI);
    ctx.fillStyle = warna.bola;
    ctx.fill();
    garis(gambaran.kisi, kamera, warna.garis);
    isi(gambaran.lainnya, kamera, warna.darat);
    garis(gambaran.batas, kamera, warna.bola);
    // Indonesia digambar terakhir, naik beberapa piksel dengan bayangan di tempat asalnya. Ukuran bayangan
    // kanvas tidak ikut skala setTransform, jadi dikali rasio piksel.
    ctx.save();
    if (a > 0) {
      ctx.shadowColor = warna.bayang;
      ctx.shadowBlur = KABUR * a * rasio;
      ctx.shadowOffsetY = ANGKAT * a * rasio;
    }
    ctx.translate(0, -ANGKAT * a);
    isi(gambaran.indonesia, kamera, warna.indonesia);
    ctx.restore();
  }

  function bingkai(waktu: number) {
    idBingkai = 0;
    const selang = waktuLalu ? waktu - waktuLalu : 0;
    waktuLalu = waktu;
    if (hadap) {
      const t = Math.min(1, (waktu - hadap.mulai) / DURASI_HADAP);
      const kemajuan = halus(Math.max(t, 0));
      const { dari, selisih } = hadap;
      proyeksi.rotate([dari[0] + selisih[0] * kemajuan, dari[1] + selisih[1] * kemajuan]);
      if (t >= 1) hadap = null;
    } else if (lempar) {
      const { dx, dy, laju } = langkahLempar(lempar, selang);
      proyeksi.rotate(seret(arahHadap(), dx, dy, proyeksi.scale()));
      lempar = Math.hypot(...laju) > LAJU_HENTI ? laju : null;
    } else if (sedangBerputar()) {
      const [sudut, miring] = arahHadap();
      proyeksi.rotate([putar(sudut, selang, arahPutar), miring]);
    }
    angkat = langkahAngkat(angkat, naik(), selang, durasiAngkat);
    gambar();
    if (hadap || lempar || sedangBerputar() || angkat !== (naik() ? 1 : 0)) minta();
    else waktuLalu = 0;
  }

  function minta() {
    if (!dilepas && !idBingkai) idBingkai = requestAnimationFrame(bingkai);
  }

  function titikDari(e: MouseEvent): Titik {
    const kotak = kanvas.getBoundingClientRect();
    return [e.clientX - kotak.left, e.clientY - kotak.top];
  }

  /** Globe menghadap titik ini, seketika bagi yang memilih kurangi animasi. */
  function hadapkan(titik: Titik) {
    const dari = arahHadap();
    const tujuan = hadapKe(titik);
    const selisih: Hadap = [selisihSudut(dari[0], tujuan[0]), tujuan[1] - dari[1]];
    if (kurangiGerak) proyeksi.rotate(tujuan);
    else if (Math.hypot(...selisih) > 0.5) hadap = { dari, selisih, mulai: performance.now() };
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
  function sorotKursor(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    kursorDiBola = kebalikan(titikDari(e)) !== null;
    kursorDiIndonesia = kursorDiBola && diIndonesia(e, TOLERANSI_KURSOR);
    kanvas.style.cursor = kursorDiIndonesia ? "pointer" : kursorDiBola ? "grab" : "";
    minta();
  }

  /** Bola yang sedang dipegang mengikuti kursor atau jari. Mengembalikan false selama geserannya belum cukup jauh. */
  function geser(e: PointerEvent, pegang: Tekan): boolean {
    if (!pegang.menyeret) {
      const dx = Math.abs(e.clientX - pegang.x);
      const dy = Math.abs(e.clientY - pegang.y);
      // Usapan jari yang tegak milik gulir halaman (touch-action: pan-y), jadi jari mulai menyeret secara mendatar.
      if (Math.hypot(dx, dy) <= GESER_KLIK_MAKS || (e.pointerType === "touch" && dx <= dy)) return false;
      pegang.menyeret = true;
      pegang.jejak = [{ waktu: e.timeStamp, x: e.clientX, y: e.clientY }];
      kursorDiIndonesia = false;
      kanvas.style.cursor = "grabbing";
    }
    const lalu = pegang.jejak[pegang.jejak.length - 1];
    proyeksi.rotate(seret(arahHadap(), e.clientX - lalu.x, e.clientY - lalu.y, proyeksi.scale()));
    pegang.jejak = [...pegang.jejak.slice(-20), { waktu: e.timeStamp, x: e.clientX, y: e.clientY }];
    minta();
    return true;
  }

  function saatGerak(e: PointerEvent) {
    // Tombolnya bisa sudah dilepas tanpa pointerup sampai ke sini, misalnya saat jendela lain mengambil alih.
    if (!(e.buttons & 1)) saatBatal(e);
    if (tekan?.aktif && e.pointerId === tekan.id && geser(e, tekan)) return;
    sorotKursor(e);
  }

  function saatKeluar(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    kursorDiBola = false;
    kursorDiIndonesia = false;
    kanvas.style.cursor = "";
    minta();
  }

  function saatTekan(e: PointerEvent) {
    if (!e.isPrimary) return;
    // Yang bisa memegang bola hanya jari atau tombol utama mouse, dan hanya bila ditekan di atas bola.
    const aktif = e.button === 0 && kebalikan(titikDari(e)) !== null;
    const jari = e.pointerType !== "mouse";
    const menangkap = aktif && lempar !== null && !kursorDiIndonesia;
    tekan = { id: e.pointerId, x: e.clientX, y: e.clientY, jari, aktif, menyeret: false, menangkap, jejak: [] };
    if (!aktif) return;
    // Sejak ditekan, gerakan dan lepasnya tetap sampai ke sini walau kursornya sudah di luar kanvas.
    kanvas.setPointerCapture(e.pointerId);
    hadap = null;
    lempar = null;
    minta();
  }

  function saatLepas(e: PointerEvent) {
    if (!tekan?.aktif || e.pointerId !== tekan.id) return;
    tekan.aktif = false;
    if (tekan.menyeret) {
      const laju = lajuLepas(tekan.jejak, e.timeStamp);
      const dilempar = Math.hypot(...laju) >= LAJU_LEMPAR;
      const mendatar = dilempar ? laju[0] : e.clientX - tekan.x;
      // Putaran berikutnya mengikuti arah seretan, dan jalan lagi walau sebelumnya dihentikan.
      if (Math.abs(mendatar) > GESER_KLIK_MAKS) arahPutar = mendatar > 0 ? 1 : -1;
      putaran.boleh = true;
      if (dilempar && !kurangiGerak) lempar = laju;
    }
    sorotKursor(e);
    minta();
  }

  /** Browser mengambil alih gerakannya, misalnya untuk menggulir halaman, jadi tidak ada lemparan. */
  function saatBatal(e: PointerEvent) {
    if (!tekan?.aktif || e.pointerId !== tekan.id) return;
    tekan.aktif = false;
    minta();
  }

  function saatKlik(e: MouseEvent) {
    const awal = tekan;
    // Klik tengah selagi bola masih dipegang tombol kiri.
    if (awal?.aktif) return;
    tekan = null;
    // Sesudah menyeret, atau bila mouse ditekan di satu tempat lalu dilepas di tempat lain, kliknya bukan pilihan.
    if (awal?.menyeret) return;
    if (awal && !awal.jari && Math.hypot(e.clientX - awal.x, e.clientY - awal.y) > GESER_KLIK_MAKS) return;
    const jari = awal ? awal.jari : mode.angkatAwal;
    const titik = kebalikan(titikDari(e));
    // Penekanan yang menangkap globe bukan pilihan, walau Indonesia kebetulan sedang lewat di bawahnya.
    if (!awal?.menangkap && diIndonesia(e, jari ? TOLERANSI_JARI : TOLERANSI_KURSOR)) {
      // Seperti tautan biasa, Ctrl, Cmd, atau Shift dengan klik, dan klik tengah, membuka tab baru.
      keIndonesia(e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey);
    } else if (e.button === 0 && titik) {
      // Klik pada bola menghentikan putaran, dan klik berikutnya melanjutkannya (WCAG 2.2.2). Globe yang tidak berputar
      // sendiri menghadap titik yang diketuk, supaya sisi lainnya bisa dilihat tanpa menyeret (WCAG 2.5.7). Ketukan yang
      // menangkap globe yang masih melaju hanya menghentikannya.
      if (mode.berputar) putaran.boleh = !putaran.boleh;
      else if (!awal?.menangkap) hadapkan(titik);
      minta();
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
  kanvas.addEventListener("pointerup", saatLepas);
  kanvas.addEventListener("pointercancel", saatBatal);
  kanvas.addEventListener("lostpointercapture", saatBatal);
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
    sorotTautan(ya) {
      tautanDisorot = ya;
      hadap = null;
      if (ya) {
        lempar = null;
        hadapkan(data.pusat);
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
      kanvas.removeEventListener("pointerup", saatLepas);
      kanvas.removeEventListener("pointercancel", saatBatal);
      kanvas.removeEventListener("lostpointercapture", saatBatal);
      kanvas.removeEventListener("pointerleave", saatKeluar);
      kanvas.removeEventListener("click", saatKlik);
      kanvas.removeEventListener("auxclick", saatKlikLain);
      kanvas.removeEventListener("mousedown", saatTekanMouse);
      kanvas.removeEventListener("contextrestored", gambar);
    },
  };
}
