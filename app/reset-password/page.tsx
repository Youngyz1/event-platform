"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      const code = searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (exchangeError) {
          setError(exchangeError.message);
          setCheckingSession(false);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    prepareRecoverySession();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-10">
        <h1 className="mb-2 text-4xl font-black">Choose new password</h1>
        <p className="mb-8 text-zinc-500">
          Enter a new password for your EventBrithe account.
        </p>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            Password updated. Redirecting you to log in.
          </div>
        )}

        {checkingSession ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm font-semibold text-zinc-500">
            Verifying reset link...
          </div>
        ) : hasRecoverySession ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block font-semibold">New Password</label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                placeholder="Min. 6 characters"
                className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">Confirm New Password</label>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                placeholder="Repeat your password"
                className="w-full rounded-2xl border border-zinc-300 px-5 py-4 outline-none focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full rounded-2xl bg-orange-500 py-4 text-lg font-bold text-white transition hover:bg-orange-600 disabled:bg-orange-300"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              This reset link is missing, expired, or already used. Request a fresh password reset link.
            </div>
            <Link
              href="/forgot-password"
              className="block rounded-2xl bg-orange-500 py-4 text-center text-lg font-bold text-white transition hover:bg-orange-600"
            >
              Request New Link
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-zinc-500">
          Back to{" "}
          <Link href="/login" className="font-semibold text-orange-500">
            log in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
