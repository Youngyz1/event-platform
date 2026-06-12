import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import SupportMessages from "@/components/SupportMessages";
import { recordDonationFromStripeSessionId } from "@/lib/donations";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import FundraiserMediaCarousel, {
  type FundraiserMediaItem,
} from "@/components/FundraiserMediaCarousel";
import FundraiserFloatingActions from "./FundraiserActions";
import FundraiserSidebar from "@/components/FundraiserSidebar";
import DonationProtectedBadge from "@/components/DonationProtectedBadge";

function paragraphs(value: string | null | undefined) {
  return (value || "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function FundraiserPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ success?: string; session_id?: string }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};

  // Record donation and extract donor context for the support message form
  let donorName = "";
  let donorEmail = "";
  let donorAmount: number | undefined = undefined;
  const stripeSessionId = query.session_id || "";

  if (query.success === "true" && stripeSessionId) {
    const result = await recordDonationFromStripeSessionId(stripeSessionId);
    // Pull donor details from the donations table so we can pre-fill the form
    if (result.fundraiserId) {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: donationRow } = await adminClient
        .from("donations")
        .select("donor_name, donor_email, amount")
        .eq("fundraiser_id", result.fundraiserId)
        .eq("payment_intent_id", stripeSessionId)
        .eq("status", "succeeded")
        .maybeSingle();
      if (donationRow) {
        donorName = donationRow.donor_name || "";
        donorEmail = donationRow.donor_email || "";
        donorAmount = Number(donationRow.amount ?? 0);
      }
    }
  }

  const { data: fundraiser } = await supabase
    .from("fundraisers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!fundraiser) return notFound();

  const { data: donations, count: donationCount } = await supabase
    .from("donations")
    .select("id, donor_name, amount, created_at", { count: "exact" })
    .eq("fundraiser_id", fundraiser.id)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: mediaRows } = await supabase
    .from("fundraiser_media")
    .select("id, image_url, caption, sort_order")
    .eq("fundraiser_id", fundraiser.id)
    .order("sort_order", { ascending: true });

  const storyParagraphs = paragraphs(fundraiser.story);
  const organizerName = fundraiser.organizer || "Campaign organizer";
  const impactAmounts = [
    { amount: 25, text: "helps cover immediate campaign needs" },
    { amount: 50, text: "moves the campaign closer to its next milestone" },
    { amount: 100, text: "creates a stronger push toward the full goal" },
  ];
  const totalDonationCount = donationCount ?? donations?.length ?? 0;
  const carouselItems: FundraiserMediaItem[] =
    mediaRows && mediaRows.length > 0
      ? mediaRows
      : [
          {
            image_url:
              fundraiser.banner ||
              "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1600&auto=format&fit=crop",
            caption: fundraiser.title,
          },
        ];

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 text-zinc-950 md:pb-0">

      {/* HERO */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-3 py-6 sm:gap-10 sm:px-6 sm:py-14 lg:grid-cols-3">

          {/* LEFT CONTENT */}
          <div className="lg:col-span-2">
            <FundraiserMediaCarousel items={carouselItems} title={fundraiser.title} />

            <div className="mt-6 sm:mt-10">
              <p className="mb-3 w-fit rounded-full bg-green-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-green-700 sm:px-4 sm:py-2 sm:text-sm">
                Community Fundraiser
              </p>
              <h1 className="text-3xl font-black leading-tight sm:text-5xl md:text-6xl">
                {fundraiser.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 sm:mt-6 sm:text-xl sm:leading-8">
                {storyParagraphs[0] || `Support ${organizerName} and help this campaign reach its goal.`}
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:rounded-2xl sm:p-5">
                  <p className="text-[9px] font-black uppercase tracking-wide text-zinc-500 sm:text-sm">Raised</p>
                  <h3 className="mt-1 text-lg font-black sm:mt-2 sm:text-2xl">${fundraiser.raised?.toLocaleString() ?? 0}</h3>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:rounded-2xl sm:p-5">
                  <p className="text-[9px] font-black uppercase tracking-wide text-zinc-500 sm:text-sm">Goal</p>
                  <h3 className="mt-1 text-lg font-black sm:mt-2 sm:text-2xl">${fundraiser.goal?.toLocaleString() ?? 0}</h3>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:rounded-2xl sm:p-5">
                  <p className="text-[9px] font-black uppercase tracking-wide text-zinc-500 sm:text-sm">Needed</p>
                  <h3 className="mt-1 text-lg font-black sm:mt-2 sm:text-2xl">${Math.max((fundraiser.goal ?? 0) - (fundraiser.raised ?? 0), 0).toLocaleString()}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* NEW SIDEBAR */}
          <div>
            <FundraiserSidebar
              fundraiserId={fundraiser.id}
              fundraiserSlug={fundraiser.slug}
              fundraiserTitle={fundraiser.title}
              initialRaised={fundraiser.raised ?? 0}
              initialGoal={fundraiser.goal ?? 0}
              initialDonations={(donations ?? []).map((d) => ({
                id: d.id,
                donor_name: d.donor_name ?? null,
                amount: Number(d.amount ?? 0),
                created_at: d.created_at,
              }))}
              initialTotalCount={totalDonationCount}
            />
          </div>

        </div>
      </section>

      {/* STORY + VIDEO */}
      <section className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10">
        <div className="grid gap-6 sm:gap-10 lg:grid-cols-3">

          {/* LEFT */}
          <div className="space-y-6 sm:space-y-10 lg:col-span-2">

            {/* VIDEO */}
            {fundraiser.video_url && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:rounded-3xl sm:p-6">
                <h2 className="mb-4 text-xl font-black sm:text-2xl">Campaign Video</h2>
                <video
                  src={fundraiser.video_url}
                  controls
                  className="w-full rounded-2xl"
                />
              </div>
            )}

            {/* DONATION PROTECTED BADGE */}
            <div>
              <DonationProtectedBadge />
            </div>

            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:rounded-3xl sm:p-8">
                <h2 className="text-xl font-black sm:text-2xl">Why This Matters</h2>
                <ul className="mt-5 space-y-4 text-zinc-700">
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-500" />
                    <span>It gives supporters a clear way to help right now.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-500" />
                    <span>It helps the organizer build momentum toward the campaign goal.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-500" />
                    <span>It keeps the campaign public, shareable, and easy to support.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:rounded-3xl sm:p-8">
                <h2 className="text-xl font-black sm:text-2xl">Donation Impact</h2>
                <div className="mt-5 space-y-4">
                  {impactAmounts.map((item) => (
                    <div key={item.amount} className="rounded-2xl bg-zinc-50 p-4">
                      <p className="font-black text-green-700">${item.amount}</p>
                      <p className="mt-1 text-zinc-600">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SupportMessages
              fundraiserId={fundraiser.id}
              donorName={donorName}
              donorEmail={donorEmail}
              donorAmount={donorAmount}
              stripeSessionId={stripeSessionId}
            />

          </div>

          {/* RIGHT */}
          <div className="space-y-6 sm:space-y-8">

            {fundraiser.organizer && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:rounded-3xl sm:p-8">
                <h2 className="mb-5 text-xl font-black sm:mb-6 sm:text-2xl">Organizer</h2>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-500" />
                  <div>
                    <h3 className="inline-flex items-center gap-2 font-bold text-xl">
                      {fundraiser.organizer}
                      <VerifiedBadge verified={false} />
                    </h3>
                    <p className="text-zinc-500">Campaign organizer</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:rounded-3xl sm:p-8">
              <h2 className="text-xl font-black sm:text-2xl">Trust & Transparency</h2>
              <div className="mt-5 space-y-4 text-zinc-700">
                <p><span className="font-black text-zinc-950">Organizer:</span> {organizerName}</p>
                <p><span className="font-black text-zinc-950">Goal:</span> ${fundraiser.goal?.toLocaleString() ?? 0}</p>
                <p><span className="font-black text-zinc-950">Progress:</span> {fundraiser.goal ? Math.min(Math.round(((fundraiser.raised ?? 0) / fundraiser.goal) * 100), 100) : 0}% funded</p>
              </div>
            </div>



            <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:rounded-3xl sm:p-8">
              <h2 className="text-xl font-black sm:text-2xl">FAQ</h2>
              <div className="mt-5 divide-y divide-zinc-200">
                {[
                  ["How much should I donate?", "Choose an amount that feels right. Presets are available, and custom amounts are supported."],
                  ["Can I share this fundraiser?", "Yes. Sharing the campaign link can be just as helpful as donating."],
                  ["Where does my support go?", `Support goes toward helping ${organizerName} reach the campaign goal shown on this page.`],
                ].map(([question, answer]) => (
                  <div key={question} className="py-4">
                    <h3 className="font-black">{question}</h3>
                    <p className="mt-2 text-zinc-600">{answer}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </section>

      <FundraiserFloatingActions title={fundraiser.title} />

    </main>
  );
}
