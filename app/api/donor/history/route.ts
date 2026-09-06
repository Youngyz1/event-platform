import { createSupabaseServer } from "@/lib/supabase-server";
import { getDonorStats } from "@/lib/donor-stats";
import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";

export async function GET() {
  try {
    const supabaseServer = await createSupabaseServer();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const stats = await getDonorStats(user.id);
    return NextResponse.json({ stats });
  } catch (err: unknown) {
    return internalError("donor/history", err);
  }
}
