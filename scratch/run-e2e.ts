import { createSupabaseAdmin } from "../lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import http from "http";

const supabaseAdmin = createSupabaseAdmin();
const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPortActive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      resolve(true);
    });
    req.on("error", () => {
      resolve(false);
    });
    req.end();
  });
}

async function run() {
  console.log("=== STARTING E2E FLOW TEST ===");

  // 1. Create a test user
  console.log("Setting up E2E test user...");
  const e2eEmail = `e2e-user-${Date.now()}@example.com`;
  const e2ePassword = "Password123!";
  
  const { data: userResult, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: e2eEmail,
    password: e2ePassword,
    email_confirm: true,
  });

  if (createError) {
    console.error("Failed to create test user:", createError);
    process.exit(1);
  }
  const testUserId = userResult.user.id;

  // Make active
  await supabaseAdmin
    .from("profiles")
    .update({ status: "active", role: "user" })
    .eq("id", testUserId);

  // Authenticate user
  const { data: sessionData, error: loginError } = await supabaseBrowser.auth.signInWithPassword({
    email: e2eEmail,
    password: e2ePassword,
  });

  if (loginError || !sessionData.session) {
    console.error("Login failed:", loginError);
    process.exit(1);
  }

  // Cookie string for Next.js auth cookie
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split(".")[0].split("//")[1];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieVal = JSON.stringify([sessionData.session.access_token, sessionData.session.refresh_token]);
  const authHeaders = {
    Cookie: `${cookieName}=${encodeURIComponent(cookieVal)}`,
  };

  // 2. Start dev server on port 3000
  console.log(`Starting Next.js dev server on port ${PORT}...`);
  const devServer = exec(`npm run dev -- -p ${PORT}`);
  
  devServer.stdout?.on("data", (chunk) => {
    console.log(`[Next Server] ${chunk.toString().trim()}`);
  });
  devServer.stderr?.on("data", (chunk) => {
    console.error(`[Next Server Error] ${chunk.toString().trim()}`);
  });

  console.log("Waiting for dev server to start...");
  let attempts = 0;
  let active = false;
  while (attempts < 60) {
    active = await checkPortActive(PORT);
    if (active) break;
    attempts++;
    await sleep(1000);
  }

  if (!active) {
    console.error("Next.js dev server failed to start.");
    devServer.kill();
    process.exit(1);
  }
  console.log("Next.js dev server is UP.");

  // 3. Request E2E test endpoint
  console.log("Triggering E2E article creation/update flow endpoint...");
  const options = {
    headers: authHeaders,
  };
  
  const req = http.get(`${BASE_URL}/api/test-e2e`, options, (res) => {
    let body = "";
    res.on("data", (chunk) => body += chunk);
    res.on("end", async () => {
      console.log("\n=== E2E FLOW RESULT ===");
      try {
        const parsed = JSON.parse(body);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (err) {
        console.log("Raw Response:", body);
      }
      
      // Cleanup test user
      console.log("\nCleaning up E2E test user...");
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
      
      // Shut down server
      console.log("Stopping dev server...");
      devServer.kill();
      console.log("=== E2E TESTS COMPLETED ===");
      process.exit(0);
    });
  });
  
  req.on("error", (e) => {
    console.error("E2E request failed:", e);
    devServer.kill();
    process.exit(1);
  });
  req.end();
}

run().catch((e) => {
  console.error("E2E Execution failed:", e);
});
