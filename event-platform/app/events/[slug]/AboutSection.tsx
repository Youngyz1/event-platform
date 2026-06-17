"use client";

import { useRef, useState, useEffect } from "react";

const LINE_HEIGHT = 28; // px — matches leading-relaxed at 1rem font
const COLLAPSED_LINES = 5;

export default function AboutSection({
  paragraphs,
}: {
  paragraphs: string[];
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);

  useEffect(() => {
    if (!contentRef.current) return;
    // If the natural height exceeds the collapsed limit, show the toggle
    const fullHeight = contentRef.current.scrollHeight;
    if (fullHeight > LINE_HEIGHT * COLLAPSED_LINES + 8) {
      setNeedsToggle(true);
    }
  }, []);

  if (paragraphs.length === 0) {
    return (
      <p className="text-zinc-500">
        Details are being finalized by the organizer.
      </p>
    );
  }

  const collapsedHeight = LINE_HEIGHT * COLLAPSED_LINES;

  return (
    <div>
      {/* Text body */}
      <div
        ref={contentRef}
        className="space-y-4 leading-relaxed text-zinc-700 overflow-hidden transition-[max-height] duration-500 ease-in-out"
        style={{
          maxHeight: expanded || !needsToggle ? "9999px" : `${collapsedHeight}px`,
        }}
      >
        {paragraphs.map((p, i) => (
          <p key={i} style={{ whiteSpace: "pre-wrap" }}>
            {p}
          </p>
        ))}
      </div>

      {/* Read more / Read less */}
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 font-bold text-orange-600 hover:text-orange-700 transition"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
