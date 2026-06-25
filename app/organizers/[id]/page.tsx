import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import OrganizerProfileClient from "./OrganizerProfileClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data: organizer } = await supabase
    .from("organizers")
    .select("name, bio, logo_url")
    .eq("id", id)
    .single();

  const title = organizer?.name
    ? `${organizer.name} — Fund4Good`
    : "Organizer — Fund4Good";
  const description =
    organizer?.bio ||
    "View this organizer's events and fundraisers on Fund4Good.";
  const image = organizer?.logo_url || "/og-image.png";

  return {
    metadataBase: new URL("https://www.fund4agoodcause.com"),
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.fund4agoodcause.com/organizers/${id}`,
      siteName: "Fund4Good",
      images: [{ url: image, width: 1200, height: 630, alt: organizer?.name || "Organizer" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function OrganizerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: organizer } = await supabase
    .from("organizers")
    .select("*")
    .eq("id", id)
    .single();

  if (!organizer) {
    return notFound();
  }

  return <OrganizerProfileClient id={id} initialData={organizer} />;
}
