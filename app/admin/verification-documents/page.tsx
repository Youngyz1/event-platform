"use client";

import { useState } from "react";

/**
 * Minimal admin viewer for private verification documents.
 *
 * Phase 1 only — deliberately not wired into the review queue. Its purpose is
 * to prove the private-bucket path works end to end: a document that is
 * unreachable by any direct URL becomes viewable to an admin, briefly, through
 * a server-minted signed link.
 *
 * Access control is not enforced here. This page lives under /admin, which
 * app/admin/layout.tsx gates with requireAdmin(), and the route it calls
 * re-checks owner-or-admin server-side. The input below is untrusted; the
 * server decides.
 */
export default function VerificationDocumentViewerPage() {
  const [path, setPath] = useState("");
  const [signedUrl, setSignedUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSignedUrl("");

    try {
      const res = await fetch("/api/verification/document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not generate a link.");
      } else {
        setSignedUrl(data.signedUrl);
      }
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-black text-zinc-950">
        Verification document viewer
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Documents live in a private bucket with no public URL and no read policy.
        Paste a storage path to mint a 60-second signed link.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block">
          <span className="mb-2 block text-sm font-black text-zinc-800">
            Storage path
          </span>
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="<user-id>/1786220000-passport.pdf"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-brand-600"
          />
        </label>

        <button
          type="submit"
          disabled={loading || !path.trim()}
          className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-800 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate signed link"}
        </button>
      </form>

      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      {signedUrl && (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
            Signed link — expires in 60 seconds
          </p>
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block break-all text-sm font-bold text-brand-700 underline"
          >
            Open document
          </a>
          {/* Inline preview for the common case. PDFs and images both render
              in an iframe; anything the browser cannot display falls back to
              the link above. */}
          <iframe
            src={signedUrl}
            title="Verification document"
            className="mt-4 h-96 w-full rounded-xl border border-zinc-200"
          />
        </div>
      )}
    </main>
  );
}
