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
    // 1. Fetch articles with owner profile
    const { data: articles, error } = await supabaseAdmin
      .from("articles")
      .select("*, profiles:owner_id(id, display_name, account_info)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // 2. Fetch all auth users to match emails
    const authResult = await listAllAuthUsers();
    if (authResult.error) throw new Error(authResult.error);

    const emailMap = new Map(authResult.users.map((u) => [u.id, u.email ?? ""]));
    const authUserMap = new Map(authResult.users.map((u) => [u.id, u]));

    // 3. Map and enrich
    const mapped = (articles ?? []).map((art) => {
      const authUser = authUserMap.get(art.owner_id);
      const email = emailMap.get(art.owner_id) ?? "";
      const authorName = authUser
        ? getUserDisplayName(art.profiles ?? null, authUser)
        : "Unknown";

      return {
        id: art.id,
        title: art.title,
        slug: art.slug,
        status: art.status,
        categories: art.categories ?? [],
        created_at: art.created_at,
        author_name: authorName,
        author_email: email,
      };
    });

    // 4. Search Filter
    const filtered = mapped.filter((art) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        art.title.toLowerCase().includes(term) ||
        art.author_name.toLowerCase().includes(term) ||
        art.author_email.toLowerCase().includes(term)
      );
    });

    // 5. Status Filter
    const statusFiltered = filtered.filter((art) => {
      if (statusTab === "all") return true;
      return art.status === statusTab;
    });

    // 6. Pagination
    const total = statusFiltered.length;
    const paginated = statusFiltered.slice(offset, offset + perPage);

    // 7. Stats (calculated on the pre-status-filtered search results so counts are accurate for the current search context)
    const stats = {
      total: filtered.length,
      published: filtered.filter((a) => a.status === "published").length,
      draft: filtered.filter((a) => a.status === "draft").length,
      scheduled: filtered.filter((a) => a.status === "scheduled").length,
    };

    return NextResponse.json({
      articles: paginated,
      stats,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load articles.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
