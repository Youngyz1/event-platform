/**
 * Test script — generates a sample certificate PDF and saves it to
 * /tmp/test-certificate.pdf, then uses Playwright to screenshot the first page.
 *
 * Run with:
 *   node --require ts-node/register scratch/test-certificate.mjs
 * Or via tsx:
 *   npx tsx scratch/test-certificate.mjs
 */

// Use dynamic import so this works as a plain .mjs without ts-node
const { jsPDF } = await import("jspdf");
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// ── helpers (inlined to avoid ts-node dep) ────────────────────────────────────

function loadSig(filename) {
  try {
    const fp = path.join(projectRoot, "public", "signatures", filename);
    if (!fs.existsSync(fp)) return null;
    const buf = fs.readFileSync(fp);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function generateDocId() {
  const n = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)}`;
}

function loadPublicImage(filename) {
  try {
    const fp = path.join(projectRoot, "public", filename);
    if (!fs.existsSync(fp)) return null;
    const ext = path.extname(filename).slice(1).toLowerCase() || "png";
    const buf = fs.readFileSync(fp);
    return `data:image/${ext};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// ── generate ─────────────────────────────────────────────────────────────────

const donorName = "Sarah Clark";
const amount = 1000;
const currency = "USD";
const fundraiserTitle = "scholarship funds";
const donationDate = "2024-07-09";
const organizerName = "Dominic Mumolo";

const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

const pageW = 297;
const pageH = 210;
const maroon = [139, 26, 26];
const gray = [140, 140, 140];
const darkText = [40, 40, 40];

// White background
doc.setFillColor(255, 255, 255);
doc.rect(0, 0, pageW, pageH, "F");

// Watermark circles — lighter, centered lower
const wmCY = 115;
doc.setFillColor(245, 245, 245);
doc.circle(pageW / 2, wmCY, 58, "F");
doc.setFillColor(250, 250, 250);
doc.circle(pageW / 2, wmCY, 50, "F");
doc.setFillColor(253, 253, 253);
doc.circle(pageW / 2, wmCY, 42, "F");

// Double maroon border
doc.setDrawColor(...maroon);
doc.setLineWidth(1.4);
doc.rect(3, 3, pageW - 6, pageH - 6);
doc.setLineWidth(0.35);
doc.rect(7, 7, pageW - 14, pageH - 14);

// Title
doc.setFont("times", "normal");
doc.setFontSize(38);
doc.setTextColor(...maroon);
doc.text("Certificate Of Appreciation", pageW / 2, 32, { align: "center" });

// Line under title
doc.setDrawColor(...maroon);
doc.setLineWidth(0.35);
doc.line(30, 37, pageW - 30, 37);

// "Recognizes"
doc.setFont("helvetica", "normal");
doc.setFontSize(11);
doc.setTextColor(...gray);
doc.text("Recognizes", pageW / 2, 47, { align: "center" });

// Donor name
doc.setFont("times", "normal");
doc.setFontSize(44);
doc.setTextColor(...darkText);
doc.text(donorName, pageW / 2, 74, { align: "center" });

// Date format MM/DD/YYYY using UTC to avoid timezone shifts
const d = new Date(donationDate);
const formattedDate = `${String(d.getUTCMonth()+1).padStart(2,"0")}/${String(d.getUTCDate()).padStart(2,"0")}/${d.getUTCFullYear()}`;

// Description lines
doc.setFont("helvetica", "normal");
doc.setFontSize(11.5);
doc.setTextColor(...gray);
doc.text(`A munificent donation for ${fundraiserTitle},`, pageW / 2, 87, { align: "center" });
doc.text(`providing financial support and generosity on ${formattedDate}.`, pageW / 2, 94, { align: "center" });

// Amount
const sym = currency.toUpperCase() === "USD" ? "$" : currency.toUpperCase() + " ";
const fmtAmount = `${sym}${amount.toLocaleString("en-US")}`;
doc.setFont("helvetica", "bold");
doc.setFontSize(13);
doc.setTextColor(...maroon);
doc.text(`Munificent ${fmtAmount} donation`, pageW / 2, 106, { align: "center" });

// Footer
const footerLineY = 155;
const leftX = 70;
const rightX = pageW - 70;
const sealCX = pageW / 2;
const sealCY = 157;
const badgeSize = 44; // mm

const leftSig = loadSig("left-sig.png");
const rightSig = loadSig("right-sig.png");
const sigW = 44;
const sigH = 18;

if (leftSig)  doc.addImage(leftSig,  "PNG", leftX  - sigW/2, footerLineY - sigH - 2, sigW, sigH);
if (rightSig) doc.addImage(rightSig, "PNG", rightX - sigW/2, footerLineY - sigH - 2, sigW, sigH);

// Left column
doc.setDrawColor(...maroon);
doc.setLineWidth(0.5);
doc.line(leftX - 38, footerLineY, leftX + 38, footerLineY);
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(...darkText);
doc.text("Dominic Mumolo", leftX, footerLineY + 7, { align: "center" });
doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(...gray);
doc.text("Director of Development", leftX, footerLineY + 13, { align: "center" });

// Right column
doc.setDrawColor(...maroon);
doc.setLineWidth(0.5);
doc.line(rightX - 38, footerLineY, rightX + 38, footerLineY);
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(...darkText);
const orgLines = doc.splitTextToSize(organizerName, 76);
doc.text(orgLines, rightX, footerLineY + 7, { align: "center" });
doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(...gray);
doc.text("Campaign Organizer", rightX, footerLineY + 7 + orgLines.length * 5.5, { align: "center" });

// Centre badge — Fund4AGoodCause logo
const logoBadge = loadPublicImage("logo_badge_no_bg.png");
if (logoBadge) {
  doc.addImage(logoBadge, "PNG",
    sealCX - badgeSize / 2,
    sealCY - badgeSize / 2,
    badgeSize,
    badgeSize
  );
}

// Bottom date + doc ID
const bottomY = pageH - 8;
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor(...maroon);
doc.text(`Date Of Issuance: ${formattedDate}`, 14, bottomY);
doc.text(`Document ID: ${generateDocId()}`, pageW - 14, bottomY, { align: "right" });

// Save PDF
const outPath = path.join(projectRoot, "scratch", "test-certificate.pdf");
const arrayBuffer = doc.output("arraybuffer");
fs.writeFileSync(outPath, Buffer.from(arrayBuffer));
console.log(`PDF saved to: ${outPath}`);
