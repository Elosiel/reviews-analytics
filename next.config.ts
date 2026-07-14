import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless-Chromium PDF rendering (/api/reports/pdf) — these ship native
  // binaries and must be required at runtime, not bundled by Next.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // @sparticuz/chromium resolves its bin/*.br files at runtime via
  // import.meta.url, not a static require() — Next's file tracer doesn't
  // follow that, so without this the Vercel function ships without the
  // binary at all ("input directory .../bin does not exist").
  outputFileTracingIncludes: {
    "/api/reports/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
