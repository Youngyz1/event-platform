import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import DonateButton from "./DonateButton";
import CommentsSection from "@/components/CommentsSection";
import { recordDonationFromStripeSessionId } from "@/lib/donations";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import FundraiserMediaCarousel, {
  type FundraiserMediaItem,
} from "@/components/FundraiserMediaCarousel";
import FundraiserFloatingActions, {
  ShareFundraiserButton,
} from "./FundraiserActions";

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

  if (query.success === "true" && query.session_id) {
    await recordDonationFromStripeSessionId(query.session_id);
  }

  const { data: fundraiser } = await supabase
    .from("fundraisers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!fundraiser) return notFound();

  const { data: donations } = await supabase
    .from("donations")
    .select("*")
    .eq("fundraiser_id", fundraiser.id)
    .order("created_at", { ascending: false })
    .limit(4);

  const { data: mediaRows } = await supabase
    .from("fundraiser_media")
    .select("id, image_url, caption, sort_order")
    .eq("fundraiser_id", fundraiser.id)
    .order("sort_order", { ascending: true });

  const progress = fundraiser.goal
    ? Math.min(Math.round((fundraiser.raised / fundraiser.goal) * 100), 100)
    : 0;

  const donationCount = donations?.length ?? 0;
  const storyParagraphs = paragraphs(fundraiser.story);
  const remaining = Math.max((fundraiser.goal ?? 0) - (fundraiser.raised ?? 0), 0);
  const organizerName = fundraiser.organizer || "Campaign organizer";
  const impactAmounts = [
    { amount: 25, text: "helps cover immediate campaign needs" },
    { amount: 50, text: "moves the campaign closer to its next milestone" },
    { amount: 100, text: "creates a stronger push toward the full goal" },
  ];
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
                  <h3 className="mt-1 text-lg font-black sm:mt-2 sm:text-2xl">${remaining.toLocaleString()}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* DONATION SIDEBAR */}
          <div>
            <div id="donate" className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8 lg:sticky lg:top-24">

              <p className="text-zinc-500 mb-2">Raised so far</p>
              <h2 className="text-4xl font-black sm:text-5xl">
                ${fundraiser.raised?.toLocaleString() ?? 0}
              </h2>
              {fundraiser.goal && (
                <p className="text-zinc-500 mt-2">
                  Goal: ${fundraiser.goal?.toLocaleString()}
                </p>
              )}

              <div className="w-full h-4 bg-zinc-200 rounded-full overflow-hidden mt-6">
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-sm text-zinc-500 mt-3">
                {donationCount} recent donation{donationCount !== 1 ? "s" : ""} shown
              </p>

              <div className="mt-6 rounded-2xl bg-green-50 p-4">
                <p className="text-sm font-bold leading-6 text-green-800">
                  Your donation helps this campaign move from story to outcome. Every contribution adds momentum.
                </p>
              </div>

              <ShareFundraiserButton
                title={fundraiser.title}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-base font-black text-zinc-800 transition hover:bg-zinc-50"
              />

              <div className="mt-8">
                <DonateButton
                  fundraiserTitle={fundraiser.title}
                  fundraiserSlug={fundraiser.slug}
                />
              </div>

            </div>
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

            {/* STORY */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:rounded-3xl sm:p-10">
              <h2 className="mb-4 text-2xl font-black sm:mb-6 sm:text-3xl">Our Story</h2>
              <div className="space-y-4 text-base leading-relaxed text-zinc-700 sm:space-y-5 sm:text-lg">
                {storyParagraphs.length > 0 ? (
                  storyParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                ) : (
                  <p>No story provided yet. The organizer can add more background, who this helps, and why support is needed now.</p>
                )}
              </div>
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

            <CommentsSection
              targetType="fundraiser"
              targetId={fundraiser.id}
              title="Comments"
              accent="green"
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
                <p><span className="font-black text-zinc-950">Progress:</span> {progress}% funded</p>
              </div>
            </div>

            {donations && donations.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:rounded-3xl sm:p-8">
                <h2 className="mb-5 text-xl font-black sm:mb-6 sm:text-2xl">Recent Donors</h2>
                <div className="space-y-5">
                  {donations.map((donation) => (
                    <div key={donation.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-200" />
                        <p className="font-medium">
                          {donation.donor_name || "Anonymous"}
                        </p>
                      </div>
                      <p className="font-bold text-green-600">
                        ${donation.amount}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
