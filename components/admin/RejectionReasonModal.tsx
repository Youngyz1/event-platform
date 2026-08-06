"use client";

import { useState } from "react";

export default function RejectionReasonModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-black text-zinc-900">Reject</h2>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Let the owner know why this was rejected..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(reason)}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white hover:bg-red-700 transition"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
