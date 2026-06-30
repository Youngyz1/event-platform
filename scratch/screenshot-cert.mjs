import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "cert-preview.html").replace(/\\/g, "/");
const outPng   = path.resolve(__dirname, "test-certificate-screenshot.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 860 } });

await page.goto(`file:///${htmlPath}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// Crop to just the certificate element
const certEl = await page.$("#cert");
await certEl.screenshot({ path: outPng });

await browser.close();
console.log(`Screenshot saved to: ${outPng}`);
