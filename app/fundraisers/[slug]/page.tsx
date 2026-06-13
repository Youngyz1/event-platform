export const dynamic = "force-dynamic";

import CommentsSection from "@/components/CommentsSection";
import DonationProtectedBadge from "@/components/DonationProtectedBadge";
import FundraiserMediaSlider, {
  type FundraiserMediaSlide,
} from "@/components/FundraiserMediaSlider";
import FundraiserShare from "@/components/FundraiserShare";
import FundraiserStory from "@/components/FundraiserStory";
import { supabase } from "@/lib/supabase";
import { recordDonationFromStripeSessionId } from "@/lib/donations";
import { notFound } from "next/navigation";
import { ShareFundraiserButton } from "./FundraiserActions";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1600&auto=format&fit=crop";

type DonationRow = {
  id: string;
  donor_name: string | null;
  amount: number | string | null;
  created_at: string;
};

type UpdateRow = {
  id: string;
  organizer_id: string | null;
  title: string | null;
  content: string;
  created_at: string;
};

type MediaRow = {
  id: string | null;
  url: string;
  type: string | null;
};

type OrganizerRow = {
  id: string;
  name: string | null;
};

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function initial(value: string) {
  return (value.trim() || "A").charAt(0).toUpperCase();
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(value: string) {
  const days = Math.floor(
    (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function OrganizerAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-black text-zinc-700">
      {initial(name)}
    </div>
  );
}

function ProgressRing({ percentage }: { percentage: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28">
      <circle
        cx="50"
        cy="50"
        r="40"
        stroke="#e5e7eb"
        strokeWidth="8"
        fill="none"
      />
      <circle
        cx="50"
        cy="50"
        r="40"
        stroke="#10b981"
        strokeWidth="8"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="16"
        fontWeight="bold"
        fill="#18181b"
      >
        {percentage}%
      </text>
    </svg>
  );
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

  const [
    mediaResult,
    updatesResult,
    donationsResult,
    organizerResult,
  ] = await Promise.all([
    supabase
      .from("fundraiser_media")
      .select("id, url, type, position")
      .eq("fundraiser_id", fundraiser.id)
      .order("position", { ascending: true }),
    supabase
      .from("fundraiser_updates")
      .select("id, organizer_id, title, content, created_at")
      .eq("fundraiser_id", fundraiser.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("donations")
      .select("id, donor_name, amount, created_at", { count: "exact" })
      .eq("fundraiser_id", fundraiser.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(5),
    fundraiser.organizer_id
      ? supabase
          .from("organizers")
          .select("id, name")
          .eq("id", fundraiser.organizer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const organizer = organizerResult.data as OrganizerRow | null;
  const organizerName =
    organizer?.name || fundraiser.organizer || "Campaign organizer";
  const coverImage =
    fundraiser.image_url || fundraiser.banner || FALLBACK_IMAGE;
  const mediaRows = (mediaResult.data ?? []) as MediaRow[];
  const media: FundraiserMediaSlide[] =
    mediaRows.length > 0
      ? mediaRows.map((item) => ({
          id: item.id,
          url: item.url,
          type: item.type,
        }))
      : [{ url: coverImage, type: "image" }];
  const updates = (updatesResult.data ?? []) as UpdateRow[];
  const recentDonors = (donationsResult.data ?? []) as DonationRow[];
  const donationCount = donationsResult.count ?? recentDonors.length;
  const raised = Number(fundraiser.raised_amount ?? fundraiser.raised ?? 0);
  const goal = Number(fundraiser.goal_amount ?? fundraiser.goal ?? 0);
  const percentage =
    goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;
  const description =
    fundraiser.description ||
    fundraiser.story ||
    fundraiser.short_description ||
    "";

  return (
    <main className="min-h-screen bg-white pb-12 text-zinc-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:py-10">
        <div className="space-y-8 lg:col-span-2">
          <header>
            <h1 className="text-3xl font-bold leading-tight text-zinc-950 sm:text-4xl">
              {fundraiser.title}
            </h1>
          </header>

          <section className="border-b border-zinc-200 pb-8">
            <FundraiserMediaSlider media={media} title={fundraiser.title} />
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <OrganizerAvatar name={organizerName} />
                <p className="text-sm text-zinc-600">
                  Organised by{" "}
                  <span className="font-bold text-zinc-950">{organizerName}</span>
                </p>
              </div>
              <DonationProtectedBadge />
            </div>
          </section>

          <FundraiserStory description={description} />

          {updates.length > 0 && (
            <section className="border-b border-zinc-200 pb-8">
              <h2 className="text-2xl font-bold text-zinc-950">
                Updates {updates.length}
              </h2>
              <div className="mt-5 space-y-5">
                {updates.map((update) => (
                  <article key={update.id} className="rounded-lg border border-zinc-200 p-5">
                    <div className="flex gap-3">
                      <OrganizerAvatar name={organizerName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-bold text-zinc-950">{organizerName}</span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600">
                            Organiser
                          </span>
                          <span className="text-zinc-500">{dateLabel(update.created_at)}</span>
                        </div>
                        {update.title && (
                          <h3 className="mt-3 text-lg font-bold text-zinc-950">
                            {update.title}
                          </h3>
                        )}
                        <p className="mt-2 whitespace-pre-wrap leading-7 text-zinc-700">
                          {update.content}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <FundraiserShare title={fundraiser.title} imageUrl={coverImage} />

          <section>
            <CommentsSection
              targetType="fundraiser"
              targetId={fundraiser.id}
              title="Words of Support"
              accent="green"
            />
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <section className="text-center">
              <div className="flex justify-center">
                <ProgressRing percentage={percentage} />
              </div>
              <p className="mt-4 text-3xl font-black text-zinc-950">
                {money(raised)} raised
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                of {money(goal)} goal
              </p>
              <p className="mt-3 text-sm font-bold text-zinc-700">
                {donationCount.toLocaleString()} donation{donationCount === 1 ? "" : "s"}
              </p>
            </section>

            <section className="space-y-3">
              <a
                href={`/fundraisers/${fundraiser.slug}/donate`}
                className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3.5 text-base font-black text-white transition hover:bg-emerald-700"
              >
                Donate now
              </a>
              <ShareFundraiserButton
                title={fundraiser.title}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-3.5 text-base font-black text-white transition hover:bg-slate-900"
              />
            </section>

            <section className="border-t border-zinc-200 pt-5">
              <h2 className="text-base font-bold text-zinc-950">Recent donors</h2>
              {recentDonors.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No donations yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {recentDonors.map((donation) => {
                    const donorName = donation.donor_name || "Anonymous";
                    const amount = Number(donation.amount ?? 0);

                    return (
                      <li key={donation.id} className="flex items-center gap-3">
                        <OrganizerAvatar name={donorName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-zinc-950">
                            {donorName}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {money(amount)} · {timeAgo(donation.created_at)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
