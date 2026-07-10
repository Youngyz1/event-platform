import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { parsePageParams } from "@/lib/admin-query";
import { supabaseAdmin, listAllAuthUsers } from "@/lib/admin-data";
import { getUserDisplayName } from "@/lib/admin-query";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const { page, perPage, offset } = parsePageParams(sp);
  const statusTab = sp.get("tab") ?? sp.get("status") ?? "all";
  const search = sp.get("search") ?? "";

  try {
    // 1. Fetch businesses with owner profile
    const { data: businesses, error } = await supabaseAdmin
      .from("businesses")
      .select("*, profiles:owner_id(id, display_name, account_info)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // 2. Fetch all auth users to match emails
    const authResult = await listAllAuthUsers();
    if (authResult.error) throw new Error(authResult.error);

    const emailMap = new Map(authResult.users.map((u) => [u.id, u.email ?? ""]));
    const authUserMap = new Map(authResult.users.map((u) => [u.id, u]));

    // 3. Map and enrich
    const mapped = (businesses ?? []).map((biz) => {
      const authUser = authUserMap.get(biz.owner_id);
      const email = emailMap.get(biz.owner_id) ?? "";
      const ownerName = authUser
        ? getUserDisplayName(biz.profiles ?? null, authUser)
        : "Unknown";

      return {
        id: biz.id,
        name: biz.name,
        slug: biz.slug,
        listing_tier: biz.listing_tier,
        status: biz.status,
        is_flagged: biz.is_flagged ?? false,
        created_at: biz.created_at,
        owner_name: ownerName,
        owner_email: email,
      };
    });

    // 4. Search Filter
    const filtered = mapped.filter((biz) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        biz.name.toLowerCase().includes(term) ||
        biz.owner_name.toLowerCase().includes(term) ||
        biz.owner_email.toLowerCase().includes(term)
      );
    });

    // 5. Status / Flagged Filter
    const tabFiltered = filtered.filter((biz) => {
      if (statusTab === "all") return true;
      if (statusTab === "flagged") return biz.is_flagged;
      return biz.status === statusTab;
    });

    // 6. Pagination
    const total = tabFiltered.length;
    const paginated = tabFiltered.slice(offset, offset + perPage);

    // 7. Stats (calculated on the pre-tab-filtered search results so counts are accurate for the current search context)
    const stats = {
      total: filtered.length,
      active: filtered.filter((b) => b.status === "active").length,
      pending_payment: filtered.filter((b) => b.status === "pending_payment").length,
      expired: filtered.filter((b) => b.status === "expired").length,
      flagged: filtered.filter((b) => b.is_flagged).length,
    };

    return NextResponse.json({
      businesses: paginated,
      stats,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load businesses.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
