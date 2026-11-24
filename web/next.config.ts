import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Alamat lama dialihkan permanen ke susunan baru (PRD 4.1). Tujuan tanpa fragmen, kecuali /sumber, supaya
  // fragmen lama seperti #perkiraan atau #perkiraan-inflasi tetap dibawa browser ke bagian yang sama.
  async redirects() {
    return [
      { source: "/prediksi", destination: "/indonesia/ke-depan", permanent: true },
      { source: "/metode", destination: "/tentang-data", permanent: true },
      { source: "/cara-kerja", destination: "/tentang-data", permanent: true },
      { source: "/sumber", destination: "/tentang-data#sumber", permanent: true },
      // Sementara, karena negara pertama di halaman Banding bisa berganti.
      { source: "/banding", destination: "/banding/malaysia", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
