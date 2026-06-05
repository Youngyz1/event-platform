import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import DonateButton from "./DonateButton";
import CommentsSection from "@/components/CommentsSection";

function paragraphs(value: string | null | undefined) {
  return (value || "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function FundraiserPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">

      {/* HERO */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-3">

          {/* LEFT CONTENT */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-3xl">
              <img
                src={fundraiser.banner || "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1600&auto=format&fit=crop"}
                alt={fundraiser.title}
                fetchPriority="high"
                decoding="async"
                className="h-[340px] w-full object-cover sm:h-[440px] lg:h-[520px]"
              />
            </div>

            <div className="mt-10">
              <p className="mb-3 w-fit rounded-full bg-green-100 px-4 py-2 text-sm font-black uppercase tracking-wide text-green-700">
                Community Fundraiser
              </p>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl md:text-6xl">
                {fundraiser.title}
              </h1>
              <p className="mt-6 max-w-3xl text-xl leading-8 text-zinc-600">
                {storyParagraphs[0] || `Support ${organizerName} and help this campaign reach its goal.`}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Raised</p>
                  <h3 className="mt-2 text-2xl font-black">${fundraiser.raised?.toLocaleString() ?? 0}</h3>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Goal</p>
                  <h3 className="mt-2 text-2xl font-black">${fundraiser.goal?.toLocaleString() ?? 0}</h3>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-sm font-black uppercase tracking-wide text-zinc-500">Still Needed</p>
                  <h3 className="mt-2 text-2xl font-black">${remaining.toLocaleString()}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* DONATION SIDEBAR */}
          <div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 lg:sticky lg:top-24">

              <p className="text-zinc-500 mb-2">Raised so far</p>
              <h2 className="text-5xl font-black">
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
      <section className="max-w-7xl mx-auto px-4 py-10 sm:px-6">
        <div className="grid lg:grid-cols-3 gap-10">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-10">

            {/* VIDEO */}
            {fundraiser.video_url && (
              <div className="bg-white border border-zinc-200 rounded-3xl p-6">
                <h2 className="text-2xl font-black mb-4">Campaign Video</h2>
                <video
                  src={fundraiser.video_url}
                  controls
                  className="w-full rounded-2xl"
                />
              </div>
            )}

            {/* STORY */}
            <div className="bg-white border border-zinc-200 rounded-3xl p-10">
              <h2 className="text-3xl font-black mb-6">Our Story</h2>
              <div className="space-y-5 text-lg leading-relaxed text-zinc-700">
                {storyParagraphs.length > 0 ? (
                  storyParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                ) : (
                  <p>No story provided yet. The organizer can add more background, who this helps, and why support is needed now.</p>
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h2 className="text-2xl font-black">Why This Matters</h2>
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

              <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h2 className="text-2xl font-black">Donation Impact</h2>
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
          <div className="space-y-8">

            {fundraiser.organizer && (
              <div className="bg-white border border-zinc-200 rounded-3xl p-8">
                <h2 className="text-2xl font-black mb-6">Organizer</h2>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-500" />
                  <div>
                    <h3 className="font-bold text-xl">{fundraiser.organizer}</h3>
                    <p className="text-zinc-500">Campaign organizer</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
              <h2 className="text-2xl font-black">Trust & Transparency</h2>
              <div className="mt-5 space-y-4 text-zinc-700">
                <p><span className="font-black text-zinc-950">Organizer:</span> {organizerName}</p>
                <p><span className="font-black text-zinc-950">Goal:</span> ${fundraiser.goal?.toLocaleString() ?? 0}</p>
                <p><span className="font-black text-zinc-950">Progress:</span> {progress}% funded</p>
              </div>
            </div>

            {donations && donations.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-3xl p-8">
                <h2 className="text-2xl font-black mb-6">Recent Donors</h2>
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

            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
              <h2 className="text-2xl font-black">FAQ</h2>
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

    </main>
  );
}
