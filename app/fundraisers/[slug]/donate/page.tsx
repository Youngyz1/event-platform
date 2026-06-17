import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import DonatePage from "./DonatePage";

export default async function FundraiserDonatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: fundraiser } = await supabase
    .from("fundraisers")
    .select("id, title, slug, organizer, banner, raised, goal")
    .eq("slug", slug)
    .single();

  if (!fundraiser) return notFound();

  return (
    <DonatePage
      fundraiserTitle={fundraiser.title}
      fundraiserSlug={fundraiser.slug}
      organizerName={fundraiser.organizer || "Campaign organizer"}
      banner={
        fundraiser.banner ||
        "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=800&auto=format&fit=crop"
      }
      raised={fundraiser.raised ?? 0}
      goal={fundraiser.goal ?? 0}
    />
  );
}
