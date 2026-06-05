"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login`
        : undefined;

    const { error: signupError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo,
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setSuccess(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-6">
      <div className="bg-white border border-zinc-200 rounded-3xl p-10 w-full max-w-md">

        <h1 className="text-4xl font-black mb-2">Create account</h1>
        <p className="text-zinc-500 mb-8">Join to create events and fundraisers.</p>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-5 py-4 rounded-2xl text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
            Account created. Check your email and confirm your account before logging in.
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
            <label className="block font-semibold mb-2">Password</label>
            <input
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              type="password"
              placeholder="Min. 6 characters"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">Confirm Password</label>
            <input
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              type="password"
              placeholder="Repeat your password"
              className="w-full border border-zinc-300 rounded-2xl px-5 py-4 outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-4 rounded-2xl font-bold text-lg transition"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-zinc-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-500 font-semibold">
            Log in
          </Link>
        </p>

      </div>
    </main>
  );
}
