"use client";

import { useState } from "react";
import Link from "next/link";
import DonorPopup from "@/components/DonorPopup";

type Props = {
  name: string;
  fundraiserTitle: string;
  /**
   * The beneficiary's user id, present once they have claimed their profile.
   * With one, the name is a link to that profile; without one there is nothing
   * to navigate to, so it opens the "profile not set up yet" card instead.
   */
  profileId?: string | null;
  className?: string;
};

/**
 * Beneficiary name on the campaign page.
 *
 * Mirrors DonorNameWithPopup, which is the pattern already used for donor names
 * in the donor list and comments — same popup component, so a name that has no
 * profile behind it behaves consistently wherever it appears.
 *
 * The name is always interactive. Previously an unclaimed beneficiary rendered
 * as dead plain text, which looked like a broken link.
 */
export default function BeneficiaryNameWithPopup({
  name,
  fundraiserTitle,
  profileId,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const style =
    className ??
    "block max-w-full truncate text-left text-sm font-black text-zinc-950 transition hover:text-brand-700 hover:underline";

  if (profileId) {
    return (
      <Link href={`/profile/${profileId}`} className={style}>
        {name}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={style}>
        {name}
      </button>
      {open && (
        <DonorPopup
          name={name}
          fundraiserTitle={fundraiserTitle}
          onClose={() => setOpen(false)}
          relationLabel={`${name} is the beneficiary of this fundraiser`}
          dialogLabel={`Beneficiary profile for ${name}`}
        />
      )}
    </>
  );
}
