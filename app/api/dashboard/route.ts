import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseServer } from "@/lib/supabase-server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: events }, { data: fundraisers }, { data: organizers }] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("id, title, slug, category, event_date, city")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("fundraisers")
      .select("id, title, slug, goal, raised")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("organizers")
      .select("id, name, bio, photo")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const fundraiserIds = (fundraisers || []).map((fundraiser) => fundraiser.id);
  const eventIds = (events || []).map((event) => event.id);

  const [{ data: donations }, { data: ticketOrders }] = await Promise.all([
    fundraiserIds.length > 0
      ? supabaseAdmin
          .from("donations")
          .select("id, fundraiser_id, donor_name, donor_email, amount, status, created_at, fundraisers(title, slug)")
          .in("fundraiser_id", fundraiserIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    eventIds.length > 0
      ? supabaseAdmin
          .from("ticket_orders")
          .select("id, event_id, buyer_email, buyer_name, quantity, total_amount, status, created_at, events(title, slug)")
          .in("event_id", eventIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    email: user.email ?? "",
    events: events || [],
    fundraisers: fundraisers || [],
    organizers: organizers || [],
    donations: donations || [],
    ticketOrders: ticketOrders || [],
  });
}
