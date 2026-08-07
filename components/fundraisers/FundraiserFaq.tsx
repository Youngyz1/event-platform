import Link from "next/link";
import { ChevronDown } from "lucide-react";

/**
 * Homepage FAQ.
 *
 * This section is the destination for the `#faq` anchors in <TrustSection>
 * ("answers to common questions") and <WhyFund4Good> ("Read the FAQ"). Those
 * links existed before the section did and resolved nowhere. **The root element
 * must keep `id="faq"`** or they break again.
 *
 * Built on native <details>/<summary> rather than a JS accordion: it expands
 * without hydration, is keyboard operable and screen-reader announced for free,
 * and each answer is present in the DOM for search engines even while collapsed.
 *
 * Every answer below reflects behaviour that actually exists in the product —
 * no platform fee for organisers (DonatePage), the optional donor tip, Stripe
 * and crypto checkout, review-before-publish (fundraisers.status starts at
 * 'pending_review'), the donation-protection terms stated in
 * <DonationProtectedBadge>, and the beneficiary claim flow. Deliberately silent
 * on payout timing and tax treatment, which are policy questions the code does
 * not answer.
 */

interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

const FAQS: FaqItem[] = [
  {
    question: "Does it cost anything to start a fundraiser?",
    answer: (
      <>
        There is no platform fee for organisers to start or run a campaign.
        Donations are processed through Stripe&apos;s encrypted checkout, and
        donors are offered an optional tip that supports Fund4Good — it is
        entirely their choice and never taken from your campaign.
      </>
    ),
  },
  {
    question: "How do I start a campaign?",
    answer: (
      <>
        <Link href="/create-fundraiser">Start your fundraiser</Link> — it takes
        a few minutes. You add your story, a goal, a cover photo, and who the
        money is for. New campaigns are reviewed before they go live, so there
        is a short wait between submitting and appearing publicly.
      </>
    ),
  },
  {
    question: "Who can I raise money for?",
    answer: (
      <>
        Yourself, someone else, a family member, a pet, or an organisation or
        charity. You choose who the campaign is for while creating it, and that
        person or cause is shown on the campaign page so supporters know exactly
        where their money is going.
      </>
    ),
  },
  {
    question: "How can supporters donate?",
    answer: (
      <>
        By card through Stripe-secured, encrypted checkout, or with
        cryptocurrency. Donating takes seconds and does not require creating an
        account.
      </>
    ),
  },
  {
    question: "Is my donation protected?",
    answer: (
      <>
        Yes. Donations of any amount are covered for one full year after you
        give, anywhere in the world, and we guarantee a full refund in the rare
        case something isn&apos;t right.
      </>
    ),
  },
  {
    question: "Will I get a receipt for my donation?",
    answer: (
      <>
        Yes — a receipt is emailed to the address you enter at checkout. Keep it
        for your records; whether a donation is tax-deductible depends on the
        cause and on where you live, so check with the organiser or a tax
        adviser if you need that confirmed.
      </>
    ),
  },
  {
    question: "Can the person I'm raising for manage their own profile?",
    answer: (
      <>
        Yes. You can invite the beneficiary by email to claim their profile.
        Once claimed, they can add their own photo, a short bio, and ways for
        supporters to reach them. Claiming a profile does not give them control
        of your campaign.
      </>
    ),
  },
  {
    question: "How do I find campaigns to support?",
    answer: (
      <>
        <Link href="/campaigns">Browse all campaigns</Link>, or narrow by where
        a campaign stands right now —{" "}
        <Link href="/campaigns?filter=trending">trending</Link>,{" "}
        <Link href="/campaigns?filter=just-launched">just launched</Link>,{" "}
        <Link href="/campaigns?filter=close-to-target">close to target</Link>,
        or <Link href="/campaigns?filter=needs-momentum">needs momentum</Link>.
      </>
    ),
  },
];

export default function FundraiserFaq() {
  return (
    <section
      id="faq"
      // scroll-mt keeps the heading clear of the sticky header when arrived at
      // via the #faq anchor.
      className="scroll-mt-24 bg-zinc-50 py-16 sm:py-20"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-brand-800">
            Common questions
          </span>
          <h2
            id="faq-heading"
            className="mt-6 text-3xl font-black leading-tight tracking-tight text-zinc-900 sm:text-4xl"
          >
            Answers before you begin
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-zinc-600">
            The things people ask most about starting a campaign and giving to
            one.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm transition hover:border-zinc-300 open:border-brand-300 open:shadow-md sm:px-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-bold text-zinc-900 [&::-webkit-details-marker]:hidden">
                <span className="text-base sm:text-lg">{faq.question}</span>
                <ChevronDown
                  aria-hidden
                  className="h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <div className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-brand-800">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>

        {/* mailto, not a /contact route — there is no contact page, and this is
            the same support address the footer and cookie policy already use. */}
        <p className="mt-10 text-center text-sm font-semibold text-zinc-500">
          Still stuck?{" "}
          <a
            href="mailto:support@fund4agoodcause.com"
            className="font-black text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            Email our team
          </a>{" "}
          and we&apos;ll help.
        </p>
      </div>
    </section>
  );
}
