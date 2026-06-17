
import FundraiserCard from "@/components/FundraiserCard";
import { supabase } from "@/lib/supabase";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fundraising Campaigns | EventBrithe",
  description:
    "Support causes, communities, and events. Donate to campaigns making a difference.",
};

export default async function FundraisersPage() {
  const { data: fundraisers } = await supabase
    .from("fundraisers")
    .select("id, title, slug, goal, raised, banner")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
       

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14">
        <div className="mb-8 sm:mb-10">
          <p className="text-xs font-black uppercase tracking-wide text-green-600 sm:text-sm">Fundraisers</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">Active Fundraisers</h1>
          <p className="mt-3 max-w-2xl text-base text-zinc-600 sm:mt-4 sm:text-lg">
            Support community campaigns and local causes.
          </p>
        </div>

        {fundraisers && fundraisers.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fundraisers.map((fundraiser) => (
              <FundraiserCard
                key={fundraiser.id}
                slug={fundraiser.slug}
                title={fundraiser.title}
                raised={fundraiser.raised ?? 0}
                goal={fundraiser.goal ?? 0}
                image={fundraiser.banner || "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1200&auto=format&fit=crop"}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-8 py-16 text-center">
            <h2 className="text-2xl font-black">No fundraisers yet.</h2>
            <p className="mt-2 text-zinc-500">Start the first fundraiser for your community.</p>
          </div>
        )}
      </section>

    </main>
  );
}
