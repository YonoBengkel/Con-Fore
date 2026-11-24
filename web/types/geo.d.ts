// Deklarasi tipe secukupnya untuk bagian d3-geo dan topojson-client yang dipakai globe halaman depan
// (lib/globe.ts dan lib/gambar-globe.ts). Kedua paket tidak membawa tipe sendiri.

declare module "d3-geo" {
  /** Objek GeoJSON, atau objek khusus d3 seperti { type: "Sphere" } untuk seluruh bola. */
  export type GeoObjek = { type: string; [kunci: string]: unknown };
  /** [bujur, lintang] dalam derajat, atau [x, y] dalam piksel layar. */
  export type Titik = [number, number];

  export interface Proyeksi {
    (titik: Titik): Titik | null;
    invert(titik: Titik): Titik | null;
    rotate(): [number, number, number];
    rotate(sudut: [number, number] | [number, number, number]): this;
    scale(): number;
    scale(skala: number): this;
    translate(): Titik;
    translate(geser: Titik): this;
  }

  export function geoOrthographic(): Proyeksi;
  /** Luas bidang di layar dalam piksel persegi, dipakai tes untuk mencocokkan jalur buatan sendiri. */
  export function geoPath(proyeksi: Proyeksi): { area(objek: GeoObjek): number };
  /** Titik di sepanjang lingkaran besar dari a (0) ke b (1), dengan jaraknya dalam radian. */
  export function geoInterpolate(a: Titik, b: Titik): ((bagian: number) => Titik) & { distance: number };
  export function geoContains(objek: GeoObjek, titik: Titik): boolean;
  export function geoCentroid(objek: GeoObjek): Titik;
  export function geoGraticule10(): GeoObjek;
}

declare module "topojson-client" {
  import type { GeoObjek } from "d3-geo";

  export type Topologi = { type: string; objects: Record<string, unknown>; arcs: unknown };
  export type Fitur = { type: "Feature"; id?: string; properties: { name: string }; geometry: GeoObjek };
  export type KumpulanFitur = { type: "FeatureCollection"; features: Fitur[] };

  export function feature(topologi: Topologi, objek: unknown): KumpulanFitur;
  export function mesh(topologi: Topologi, objek: unknown, saring?: (a: unknown, b: unknown) => boolean): GeoObjek;
}
