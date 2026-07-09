import { createSupabaseAdmin } from "../lib/supabase-admin";
import http from "http";

const supabaseAdmin = createSupabaseAdmin();
const AUTHOR_ID = "9935d474-8cbb-4773-b9b1-6acb7f31cb41";
const DRAFT_SLUG = "test-runtime-draft-inspect";

async function run() {
  // Clean up and insert draft article
  await supabaseAdmin.from("articles").delete().eq("slug", DRAFT_SLUG);
  await supabaseAdmin.from("articles").insert({
    owner_id: AUTHOR_ID,
    title: "Test Draft Inspect",
    slug: DRAFT_SLUG,
    body: "<p>This is a test draft article body with enough characters.</p>",
    status: "draft",
    visibility: "public",
    categories: ["Test"],
    tags: ["test"],
    reading_time: 1,
  });

  console.log("Requesting draft article...");
  const req = http.get(`http://localhost:3000/articles/${DRAFT_SLUG}`, (res) => {
    console.log("Status Code:", res.statusCode);
    console.log("Headers:", res.headers);
    let body = "";
    res.on("data", (chunk) => body += chunk);
    res.on("end", async () => {
      console.log("Body length:", body.length);
      console.log("Body snippet:", body.slice(0, 500));
      
      // Clean up
      await supabaseAdmin.from("articles").delete().eq("slug", DRAFT_SLUG);
      process.exit(0);
    });
  });
  req.on("error", (e) => {
    console.error("Request failed:", e);
    process.exit(1);
  });
  req.end();
}

run();
