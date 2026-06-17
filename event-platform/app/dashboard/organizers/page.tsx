import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardContext, supabaseAdmin } from "@/lib/dashboard-context";

function numberLabel(value: number) {
  return Number(value || 0).toLocaleString();
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

export default async function DashboardOrganizersPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/login");

  const { organizers, organizerIds } = ctx;

  const [eventsResult, fundraisersResult, followsResult] = organizerIds.length > 0
    ? await Promise.all([
        supabaseAdmin
          .from("events")
          .select("id, organizer_id, status")
          .in("organizer_id", organizerIds),
        supabaseAdmin
          .from("fundraisers")
          .select("id, organizer_id, raised, goal")
          .in("organizer_id", organizerIds),
        supabaseAdmin
          .from("organizer_follows")
          .select("organizer_id")
          .in("organizer_id", organizerIds),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  const events = eventsResult.data ?? [];
  const fundraisers = fundraisersResult.data ?? [];
  const follows = followsResult.data ?? [];

  const stats = Object.fromEntries(
    organizers.map((organizer) => {
      const organizerEvents = events.filter((event) => event.organizer_id === organizer.id);
      const organizerFundraisers = fundraisers.filter((fundraiser) => fundraiser.organizer_id === organizer.id);
      const totalRaised = organizerFundraisers.reduce((sum, fundraiser) => sum + Number(fundraiser.raised ?? 0), 0);
      const totalGoal = organizerFundraisers.reduce((sum, fundraiser) => sum + Number(fundraiser.goal ?? 0), 0);
      const followerCount = follows.filter((follow) => follow.organizer_id === organizer.id).length;

      return [
        organizer.id,
        {
          events: organizerEvents.length,
          approvedEvents: organizerEvents.filter((event) => (event.status ?? "approved") === "approved").length,
          fundraisers: organizerFundraisers.length,
          totalRaised,
          totalGoal,
          followers: followerCount,
        },
      ];
    })
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-4 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm sm:rounded-2xl sm:px-6 sm:py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-orange-600 sm:text-xs">Dashboard</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Organizers</h1>
          <p className="mt-1 text-xs font-medium text-zinc-500 sm:text-sm">
            View, create, edit, and monitor the public organizer profiles owned by your account.
          </p>
        </div>
        <Link
          href="/create-organizer"
          className="w-fit rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-black text-white hover:bg-orange-700 sm:rounded-xl sm:px-5 sm:py-3 sm:text-sm"
        >
          + Create Organizer
        </Link>
      </header>

      {organizers.length === 0 ? (
        <section className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center shadow-sm sm:rounded-2xl sm:px-8 sm:py-20">
          <p className="text-xl font-black text-zinc-950 sm:text-2xl">No organizers yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs font-medium text-zinc-500 sm:text-sm">
            Create an organizer profile before launching events, fundraisers, or imports.
          </p>
          <Link
            href="/create-organizer"
            className="mt-6 inline-block rounded-xl bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700"
          >
            Create Organizer
          </Link>
        </section>
      ) : (
        <section className="grid gap-4 sm:gap-5">
          {organizers.map((organizer) => {
            const organizerStats = stats[organizer.id] ?? {
              events: 0,
              approvedEvents: 0,
              fundraisers: 0,
              totalRaised: 0,
              totalGoal: 0,
              followers: 0,
            };
            const progress = organizerStats.totalGoal
              ? Math.min(Math.round((organizerStats.totalRaised / organizerStats.totalGoal) * 100), 100)
              : 0;

            return (
              <article key={organizer.id} className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 sm:h-16 sm:w-16">
                      {organizer.photo ? (
                        <img src={organizer.photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-black text-zinc-500">{organizer.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-black text-zinc-950 sm:text-2xl">{organizer.name}</h2>
                      <p className="mt-1 line-clamp-2 max-w-2xl text-sm font-medium leading-6 text-zinc-500">
                        {organizer.bio || "No organizer bio yet."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/organizers/${organizer.id}`} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-black text-zinc-700 hover:bg-zinc-50">
                      View
                    </Link>
                    <Link href={`/organizers/${organizer.id}/edit`} className="rounded-lg border border-orange-200 px-3 py-2 text-xs font-black text-orange-700 hover:bg-orange-50">
                      Edit
                    </Link>
                    <Link href={`/create-event?organizer=${organizer.id}`} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-black text-white hover:bg-orange-700">
                      New Event
                    </Link>
                    <Link href={`/create-fundraiser?organizer=${organizer.id}`} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">
                      New Fundraiser
                    </Link>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
                  {[
                    ["Followers", numberLabel(organizerStats.followers)],
                    ["Events", numberLabel(organizerStats.events)],
                    ["Approved", numberLabel(organizerStats.approvedEvents)],
                    ["Fundraisers", numberLabel(organizerStats.fundraisers)],
                    ["Raised", money(organizerStats.totalRaised)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">{label}</p>
                      <p className="mt-1 text-lg font-black text-zinc-950">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-black text-zinc-500">
                    <span>Fundraising progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
