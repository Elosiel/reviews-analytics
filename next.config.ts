import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless-Chromium PDF rendering (/api/reports/pdf) — these ship native
  // binaries and must be required at runtime, not bundled by Next.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
