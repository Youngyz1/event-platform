import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }

  const { data: orders, error } = await supabaseAdmin
    .from("ticket_orders")
    .select(`
      id,
      qr_code,
      status,
      seat_label,
      quantity,
      total_amount,
      created_at,
      checked_in_at,
      events (
        title,
        event_date,
        venue,
        city,
        banner,
        slug
      )
    `)
    .eq("buyer_email", email)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: orders || [] });
}