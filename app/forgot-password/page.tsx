"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const redirectTo = appUrl ? `${appUrl}/reset-password` : undefined;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-10">
        <h1 className="mb-2 text-4xl font-black">Reset password</h1>
        <p className="mb-8 text-zinc-500">
          Enter your account email and we&apos;ll send you a secure password reset link.
        </p>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-brand-800">
            Password reset email sent. Check your inbox and follow the link to set a new password.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block font-semibold">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-brand-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white transition hover:bg-brand-700 disabled:bg-brand-300"
          >
            {loading ? "Sending reset link..." : "Send Reset Link"}
          </button>
        </form>

        <p className="mt-6 text-center text-zinc-500">
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-brand-600">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
