import { jsPDF } from "jspdf";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Loads a signature image from /public/signatures/ and returns a base64 data URL.
 * Returns null if the file doesn't exist (graceful fallback).
 */
function loadSignatureImage(filename: string): string | null {
  try {
    const filePath = path.join(process.cwd(), "public", "signatures", filename);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Generates a Certificate of Appreciation PDF matching the navy/gold design.
 * Left signee: Dominic Mumolo, Director of Development (static)
 * Right signee: Campaign organizer name (dynamic per donation)
 */
export async function generateCertificatePdf(
  donorName: string,
  amount: number,
  currency: string,
  fundraiserTitle: string,
  donationDate: string,
  organizerName: string
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageW = 297;
  const pageH = 210;

  // ── Subtle diamond background pattern ────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.15);
  const spacing = 8;
  for (let x = 0; x <= pageW + spacing; x += spacing) {
    for (let y = 0; y <= pageH + spacing; y += spacing) {
      const s = spacing / 2;
      doc.line(x, y - s, x + s, y);
      doc.line(x + s, y, x, y + s);
      doc.line(x, y + s, x - s, y);
      doc.line(x - s, y, x, y - s);
    }
  }

  // ── Navy header ───────────────────────────────────────────────────────────
  doc.setFillColor(26, 42, 74);
  doc.rect(0, 0, pageW, 72, "F");

  // Curved bottom of header
  doc.setFillColor(255, 255, 255);
  doc.ellipse(pageW / 2, 72, pageW * 0.6, 22, "F");

  // ── Header title ──────────────────────────────────────────────────────────
  doc.setFont("times", "bolditalic");
  doc.setFontSize(42);
  doc.setTextColor(201, 168, 76);
  doc.text("Certificate", pageW / 2, 30, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(24);
  doc.text("of Appreciation", pageW / 2, 48, { align: "center" });

  // ── "This is to certify that" ─────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(130, 130, 140);
  doc.text("This is to certify that", pageW / 2, 86, { align: "center" });

  // ── Donor name ────────────────────────────────────────────────────────────
  const displayName = donorName || "Anonymous";
  doc.setFont("times", "bold");
  doc.setFontSize(38);
  doc.setTextColor(26, 42, 74);
  doc.text(displayName, pageW / 2, 104, { align: "center" });

  // Gold underline beneath name
  const nameW = Math.min(doc.getTextWidth(displayName), 120);
  const lineX1 = pageW / 2 - nameW / 2;
  const lineX2 = pageW / 2 + nameW / 2;
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.8);
  doc.line(lineX1, 107, lineX2, 107);

  // ── Donation description ──────────────────────────────────────────────────
  const currencySymbol = currency.toUpperCase() === "USD" ? "$" : "";
  const formattedAmount = `${currencySymbol}${amount.toFixed(2)}`;
  const formattedDate = new Date(donationDate).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const shortTitle = fundraiserTitle.length > 55
    ? fundraiserTitle.substring(0, 52) + "..."
    : fundraiserTitle;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(44, 62, 80);
  doc.text(`Has donated ${formattedAmount} ${currency.toUpperCase()} to "${shortTitle}"`, pageW / 2, 120, { align: "center" });
  doc.text(`fundraising campaign on ${formattedDate}.`, pageW / 2, 128, { align: "center" });

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerBaseY = 165;
  const leftX  = 68;
  const rightX = pageW - 68;
  const sealX  = pageW / 2;

  // Load signature images
  const leftSig  = loadSignatureImage("left-sig.png");
  const rightSig = loadSignatureImage("right-sig.png");

  const sigW = 40;
  const sigH = 15;

  if (leftSig) {
    doc.addImage(leftSig, "PNG", leftX - sigW / 2, footerBaseY - sigH - 4, sigW, sigH);
  }

  if (rightSig) {
    doc.addImage(rightSig, "PNG", rightX - sigW / 2, footerBaseY - sigH - 4, sigW, sigH);
  }

  // Left signee line + name + title
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.5);
  doc.line(leftX - 36, footerBaseY, leftX + 36, footerBaseY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(26, 42, 74);
  doc.text("Dominic Mumolo", leftX, footerBaseY + 7, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text("Director of Development", leftX, footerBaseY + 13, { align: "center" });

  // Right signee line + name + title
  const displayOrgName = organizerName || "Campaign Organizer";

  doc.setDrawColor(201, 168, 76);
  doc.line(rightX - 36, footerBaseY, rightX + 36, footerBaseY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(26, 42, 74);
  doc.text(displayOrgName, rightX, footerBaseY + 7, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text("Campaign Organizer", rightX, footerBaseY + 13, { align: "center" });

  // ── Gold "Verified Donor" seal ────────────────────────────────────────────
  const sealY  = footerBaseY - 2;
  const outerR = 20;

  doc.setFillColor(180, 140, 30);
  doc.circle(sealX, sealY, outerR, "F");

  doc.setFillColor(201, 168, 76);
  doc.circle(sealX, sealY, outerR - 2, "F");

  doc.setFillColor(255, 255, 255);
  doc.circle(sealX, sealY, outerR - 4, "F");

  doc.setFillColor(201, 168, 76);
  doc.circle(sealX, sealY, outerR - 5.5, "F");

  // Laurel dots
  const laurelR = outerR - 2.8;
  doc.setFillColor(255, 255, 255);
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const lx = sealX + Math.cos(angle) * laurelR;
    const ly = sealY + Math.sin(angle) * laurelR;
    doc.circle(lx, ly, 0.6, "F");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("★  ★  ★", sealX, sealY - 5.5, { align: "center" });
  doc.text("VERIFIED", sealX, sealY + 1, { align: "center" });
  doc.text("DONOR", sealX, sealY + 7, { align: "center" });

  // ── Gold bottom border ────────────────────────────────────────────────────
  doc.setFillColor(201, 168, 76);
  doc.rect(0, pageH - 5, pageW, 5, "F");

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/**
 * Handles the full certificate flow:
 * 1. Fetches donation + fundraiser + organizer data from Supabase
 * 2. Generates the certificate PDF
 * 3. Emails it to the donor via Resend
 */
export async function processDonationCertificate(donationId: string) {
  try {
    // 1. Fetch donation
    const { data: donation, error: donErr } = await supabaseAdmin
      .from("donations")
      .select("id, donor_name, donor_email, amount, currency, created_at, fundraiser_id")
      .eq("id", donationId)
      .single();

    if (donErr || !donation) {
      console.error(`[processDonationCertificate] Donation ${donationId} not found:`, donErr?.message);
      return;
    }

    if (!donation.donor_email) {
      console.log(`[processDonationCertificate] No donor email for donation ${donationId}, skipping.`);
      return;
    }

    // 2. Fetch fundraiser + organizer_id
    const { data: fundraiser, error: fundErr } = await supabaseAdmin
      .from("fundraisers")
      .select("title, organizer_id")
      .eq("id", donation.fundraiser_id)
      .single();

    if (fundErr || !fundraiser) {
      console.error(`[processDonationCertificate] Fundraiser ${donation.fundraiser_id} not found:`, fundErr?.message);
      return;
    }

    // 3. Fetch organizer name (dynamic right signee)
    let organizerName = "Campaign Organizer";
    if (fundraiser.organizer_id) {
      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("name")
        .eq("id", fundraiser.organizer_id)
        .single();
      if (organizer?.name) organizerName = organizer.name;
    }

    // 4. Generate PDF
    const pdfBuffer = await generateCertificatePdf(
      donation.donor_name || "Anonymous",
      donation.amount,
      donation.currency,
      fundraiser.title || "Campaign",
      donation.created_at,
      organizerName
    );

    // 4b. Update certificate_path in donations table
    await supabaseAdmin
      .from("donations")
      .update({ certificate_path: `/api/certificates/${donationId}` })
      .eq("id", donationId);

    // 5. Send via Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const { error: emailErr } = await resend.emails.send({
        from: "Fund4Good <contact@fund4agoodcause.com>",
        to: donation.donor_email,
        subject: `Your Certificate of Appreciation — ${fundraiser.title} 🏅`,
        html: `
  <div style="font-family: sans-serif; color: #18181b; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://fund4agoodcause.com/fund4good-logo.png" alt="Fund4Good" style="height: 60px; width: auto;" />
    </div>
    <h2 style="color: #1a2a4a; margin-bottom: 20px;">Your Certificate of Appreciation</h2>
            <p>Hi ${donation.donor_name || "there"},</p>
            <p>On behalf of everyone at <strong>Fund4Good</strong>, thank you for your generous donation of
               <strong>$${donation.amount.toFixed(2)} ${donation.currency.toUpperCase()}</strong>
               to <strong>${fundraiser.title}</strong>.</p>
            <p>Please find attached your official Certificate of Appreciation.
               You can download and share it to inspire others to give.</p>
            <p style="margin-top: 30px; font-size: 12px; color: #71717a;">
              Fund4Good · support@fund4agoodcause.com
            </p>
          </div>
        `,
        attachments: [
          {
            filename: "donation_certificate.pdf",
            content: pdfBuffer.toString("base64"),
          },
        ],
      });

      if (emailErr) {
        console.error(
          `[processDonationCertificate] Resend rejected email to ${donation.donor_email}:`,
          JSON.stringify(emailErr, null, 2)
        );
      } else {
        console.log(`[processDonationCertificate] Certificate email sent to ${donation.donor_email}`);
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("[processDonationCertificate] Unexpected error:", err.message, err.stack);
    } else {
      console.error("[processDonationCertificate] Unexpected error:", err);
    }
  }
}