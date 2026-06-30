import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "check-logo.html").replace(/\\/g, "/");
const outPng   = path.resolve(__dirname, "check-logo.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(`file:///${htmlPath}`, { waitUntil: "networkidle" });
await page.screenshot({ path: outPng });
await browser.close();
console.log("Screenshot saved to", outPng);
