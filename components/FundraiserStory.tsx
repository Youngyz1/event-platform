"use client";

import { useState } from "react";

export default function FundraiserStory({
  description,
}: {
  description: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = description.trim();
  const shouldClamp = trimmed.length > 300;
  const visible = shouldClamp && !expanded ? `${trimmed.slice(0, 300)}...` : trimmed;

  return (
    <section className="border-b border-zinc-200 pb-8">
      <div className="mt-4 space-y-4 text-base leading-7 text-zinc-700">
        {(visible || "No story has been added yet.")
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph) => (
            <p key={paragraph} className="whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
      </div>
      {shouldClamp && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-4 text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </section>
  );
}
