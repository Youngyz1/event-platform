import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/verify-ticket?code=XXXXX — look up ticket status
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided." }, { status: 400 });
  }

  const { data: order, error } = await supabaseAdmin
    .from("ticket_orders")
    .select(`
      id,
      status,
      seat_label,
      quantity,
      buyer_name,
      buyer_email,
      total_amount,
      created_at,
      checked_in_at,
      event_id,
      events (
        title,
        event_date,
        venue,
        city,
        banner
      )
    `)
    .eq("qr_code", code)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Ticket not found.", valid: false }, { status: 404 });
  }

  return NextResponse.json({
    valid: order.status === "valid",
    order,
  });
}

// POST /api/verify-ticket — check in a ticket (mark as used)
export async function POST(req: NextRequest) {
  try {
    const { code, action } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "No code provided." }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from("ticket_orders")
      .select("id, status")
      .eq("qr_code", code)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Ticket not found.", valid: false }, { status: 404 });
    }

    if (action === "checkin") {
      if (order.status === "used") {
        return NextResponse.json({
          success: false,
          message: "Ticket already used.",
          status: "used",
        });
      }

      if (order.status !== "valid") {
        return NextResponse.json({
          success: false,
          message: `Ticket is ${order.status}.`,
          status: order.status,
        });
      }

      await supabaseAdmin
        .from("ticket_orders")
        .update({ status: "used", checked_in_at: new Date().toISOString() })
        .eq("id", order.id);

      return NextResponse.json({
        success: true,
        message: "Ticket checked in successfully!",
        status: "used",
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
