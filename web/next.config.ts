import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Cara kerja dan Sumber data digabung menjadi Metode (PRD 4.1). Pengalihan permanen menjaga tautan lama.
  // Tujuan /metode tanpa fragmen, supaya fragmen lama seperti #skor tetap dibawa browser.
  async redirects() {
    return [
      { source: "/cara-kerja", destination: "/metode", permanent: true },
      { source: "/sumber", destination: "/metode#sumber", permanent: true },
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
