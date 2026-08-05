"use client";

import { useState } from "react";
import { AlertCircle, Check, Share2 } from "lucide-react";
import { copyTextToClipboard } from "@/lib/clipboard";

interface ShareButtonProps {
  getUrl: () => string;
  label?: string;
}

/**
 * Presentational share/copy-link button — centralizes the idle/copied/failed
 * state machine that was previously duplicated inline per page. Pure UI on
 * top of the existing lib/clipboard.ts helper; no new business logic.
 */
export default function ShareButton({ getUrl, label = "Share" }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleClick() {
    const succeeded = await copyTextToClipboard(getUrl());
    setStatus(succeeded ? "copied" : "failed");
    setTimeout(() => setStatus("idle"), succeeded ? 1800 : 3000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={status === "failed" ? "Copy failed — long-press the link to copy manually" : undefined}
      className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
    >
      {status === "copied" ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : status === "failed" ? (
        <AlertCircle className="h-4 w-4 text-red-600" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      {status === "copied" ? "Copied!" : status === "failed" ? "Copy failed" : label}
    </button>
  );
}
