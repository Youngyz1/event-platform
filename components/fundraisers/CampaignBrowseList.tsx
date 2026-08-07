"use client";

import { useState } from "react";
import FundraiserListRow from "@/components/FundraiserListRow";

export type CampaignBrowseItem = {
  id: string;
  slug: string;
  title: string;
  raised: number;
  goal: number;
  image: string | null;
  category: string | null;
  beneficiaryName?: string | null;
  beneficiaryType?: string | null;
  donationCount?: number;
};

/** Rows visible before the first "Show more" click. */
const INITIAL_VISIBLE = 4;
/** Additional rows revealed per click. */
const REVEAL_STEP = 4;

/**
 * Progressive-disclosure wrapper for the /campaigns browse list. The page
 * already fetches the whole (capped) result set in a single query, so
 * revealing more is instant local state — no extra request, no spinner.
 */
export default function CampaignBrowseList({ items }: { items: CampaignBrowseItem[] }) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const visible = items.slice(0, visibleCount);
  const remaining = items.length - visible.length;

  return (
    <>
      <div className="divide-y divide-zinc-100">
        {visible.map((item) => (
          <FundraiserListRow
            key={item.id}
            slug={item.slug}
            title={item.title}
            raised={item.raised}
            goal={item.goal}
            image={item.image}
            category={item.category}
            beneficiaryName={item.beneficiaryName}
            beneficiaryType={item.beneficiaryType}
            donationCount={item.donationCount}
          />
        ))}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + REVEAL_STEP)}
          className="mt-6 w-full rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99]"
        >
          Show more
          <span className="ml-1.5 font-bold text-zinc-400">({remaining})</span>
        </button>
      )}
    </>
  );
}
