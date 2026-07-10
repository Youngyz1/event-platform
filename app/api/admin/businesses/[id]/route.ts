import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/admin-data";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { is_flagged } = await req.json();

  if (typeof is_flagged !== "boolean") {
    return NextResponse.json(
      { error: "Invalid parameters. is_flagged must be a boolean." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("businesses")
    .update({ is_flagged })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("businesses")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
