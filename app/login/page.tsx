"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      setError("Please verify your email before logging in.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-6">
      <div className="bg-white border border-zinc-200 rounded-3xl p-10 w-full max-w-md">

        <h1 className="text-4xl font-black mb-2">Welcome back</h1>
        <p className="text-zinc-500 mb-8">Log in to your account.</p>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
            <p>{error}</p>
            <Link
              href={`/forgot-password${form.email ? `?email=${encodeURIComponent(form.email)}` : ""}`}
              className="mt-2 inline-block font-black text-red-700 underline underline-offset-4"
            >
              Forgot your password?
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-semibold mb-2">Email</label>
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              type="email"
              placeholder="you@example.com"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block font-semibold">Password</label>
              <Link
                href={`/forgot-password${form.email ? `?email=${encodeURIComponent(form.email)}` : ""}`}
                className="text-sm font-black text-orange-600 hover:text-orange-700"
              >
                Forgot password?
              </Link>
            </div>
            <input
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              type="password"
              placeholder="Your password"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-4 rounded-2xl font-bold text-lg transition"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-zinc-500 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-orange-500 font-semibold">
            Sign up
          </Link>
        </p>

      </div>
    </main>
  );
}
