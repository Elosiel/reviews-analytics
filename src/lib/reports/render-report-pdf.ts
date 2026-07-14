/**
 * Server-side PDF rendering for the weekly report — a real Chromium
 * print of the locked export template (see CLAUDE.md "Weekly Report
 * Structure"). This is the same engine class that produces a browser's
 * own "Save as PDF" output: real embedded fonts, vector text, correct
 * pagination via the template's break-inside rules — and, unlike any
 * client-side approach, it renders identically for every user because
 * the file is produced here, not in whatever browser/bundle state the
 * client happens to have.
 *
 * Runtime resolution:
 *  - CHROME_EXECUTABLE_PATH env var, if set (explicit override)
 *  - @sparticuz/chromium on Vercel/AWS Lambda (serverless-packaged Chromium)
 *  - common local install paths for dev machines/sandboxes
 *
 * Server-only: imported exclusively from the /api/reports/pdf route.
 */

import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const LOCAL_CHROME_PATHS = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

interface LaunchTarget {
  executablePath: string;
  args: string[];
  headless: boolean | "shell";
  defaultViewport?: { width: number; height: number } | null;
}

// The viewport @sparticuz/chromium's own README uses for its launch example —
// kept as a plain constant since this package version doesn't expose it.
const SPARTICUZ_VIEWPORT = { width: 1920, height: 1080 };

// Rendering is hermetic — fonts are embedded as data URIs
// (report-fonts.ts), so Chromium needs no network access at all.
function localArgs(): string[] {
  return ["--no-sandbox", "--disable-setuid-sandbox"];
}

async function resolveLaunchTarget(): Promise<LaunchTarget> {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return { executablePath: process.env.CHROME_EXECUTABLE_PATH, args: localArgs(), headless: true };
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // @sparticuz/chromium ships the "chrome-headless-shell" binary, not a
    // full Chromium build. Puppeteer only emits the flag that binary
    // understands (bare `--headless`, not `--headless=new`) when the launch
    // option is the string "shell" — passing headless: true here makes
    // puppeteer add `--headless=new`, which the shell binary can't run
    // under, so the browser process fails to launch.
    const chromium = (await import("@sparticuz/chromium")).default;
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: "shell",
      defaultViewport: SPARTICUZ_VIEWPORT,
    };
  }
  const local = LOCAL_CHROME_PATHS.find((p) => existsSync(p));
  if (!local) {
    throw new Error(
      "No Chromium executable found — set CHROME_EXECUTABLE_PATH or run on Vercel/Lambda"
    );
  }
  return { executablePath: local, args: localArgs(), headless: true };
}

/**
 * Renders a full HTML document string to letter-size PDF bytes.
 * Waits for network idle + document.fonts.ready so the @import'ed
 * Google fonts (Fraunces/Geist) are embedded, not substituted.
 */
export async function renderReportPdf(fullHtmlDoc: string): Promise<Buffer> {
  const { executablePath, args, headless, defaultViewport } = await resolveLaunchTarget();
  const browser = await puppeteer.launch({ executablePath, args, headless, defaultViewport });
  try {
    const page = await browser.newPage();
    // Rendering is hermetic (fonts embedded as data URIs), so "load" is
    // complete; fonts.ready then guarantees the embedded faces are active.
    await page.setContent(fullHtmlDoc, { waitUntil: "load", timeout: 30_000 });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
