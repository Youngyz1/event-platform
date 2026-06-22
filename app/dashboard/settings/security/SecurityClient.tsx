"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { SettingsCard } from "@/components/ui/settings-card";

export default function SecurityClient({
  email,
  createdAt,
  lastSignIn,
}: {
  email: string;
  createdAt: string;
  lastSignIn?: string;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  const [sendingReset, setSendingReset] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    
    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }
    
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw new Error(updateError.message);

      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function sendPasswordReset() {
    setError("");
    setSendingReset(true);
    try {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const redirectTo = appUrl ? `${appUrl}/reset-password` : undefined;
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) throw new Error(resetError.message);
      showToast("Password reset email sent. Check your inbox.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send password reset email.");
    } finally {
      setSendingReset(false);
    }
  }

  // Format dates
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Direct Password Update */}
      <form onSubmit={handlePasswordUpdate}>
        <SettingsCard
          title="Update Password"
          description="Update your account password. Must be at least 6 characters."
          footer={
            <button
              type="submit"
              disabled={updatingPassword}
              className="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-black text-white hover:bg-orange-700 disabled:opacity-60 transition"
            >
              {updatingPassword ? "Updating..." : "Update Password"}
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
                New Password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold outline-hidden transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 sm:rounded-xl sm:px-4 sm:py-2.5"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-zinc-500">
                Confirm New Password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold outline-hidden transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 sm:rounded-xl sm:px-4 sm:py-2.5"
              />
            </label>
          </div>
        </SettingsCard>
      </form>

      {/* Password Reset via Email Link */}
      <SettingsCard
        title="Email Password Reset Link"
        description="Alternatively, we can send you an email containing a secure link to reset your password outside the app."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-zinc-800">Send Reset Email to</p>
            <p className="text-xs font-medium text-zinc-500">{email}</p>
          </div>
          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={sendingReset}
            className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 transition text-center"
          >
            {sendingReset ? "Sending..." : "Send Reset Email"}
          </button>
        </div>
      </SettingsCard>

      {/* Account Info Details */}
      <SettingsCard
        title="Access History"
        description="Metadata and security statistics regarding your account access."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-zinc-100">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">Registered Email</span>
            <span className="text-sm font-bold text-zinc-900">{email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-zinc-100">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">Account Created</span>
            <span className="text-sm font-bold text-zinc-900">{formatDate(createdAt)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">Last Signed In</span>
            <span className="text-sm font-bold text-zinc-900">{formatDate(lastSignIn)}</span>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
