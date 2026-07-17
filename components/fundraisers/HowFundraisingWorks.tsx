import { Copy, Link2, Lock, Mail, MessageCircle, Share2, ShieldCheck } from "lucide-react";
import HowItWorks, { type HowItWorksStep } from "@/components/marketing/HowItWorks";

/**
 * Fundraiser-specific "how it works" content: three real-flow steps plus the
 * mockups that visualize them. The generic <HowItWorks> handles layout and the
 * synced media panel; everything domain-specific lives here so the shell stays
 * reusable across product pages.
 *
 * Field labels/placeholders mirror the real create-fundraiser wizard. The
 * payout mockup is intentionally conceptual (masked placeholder, Stripe-backed)
 * because payouts are not a step in the create form.
 */

// Reused mockup primitives — keep the three previews visually consistent.
function MockLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-black uppercase tracking-wider text-zinc-500">
      {children}
    </span>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MockLabel>{label}</MockLabel>
      <div className="mt-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-800">
        {value}
      </div>
    </div>
  );
}

function CreateFormMock() {
  return (
    <div className="space-y-4 rounded-2xl bg-white/70 p-5 ring-1 ring-zinc-200">
      <MockField label="Fundraiser Title" value="Support Education for Underprivileged Children" />
      <MockField label="Fundraising Goal" value="$20,000" />
      <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
        <span aria-hidden>💡</span>
        <span>The first photo you add becomes your fundraiser cover.</span>
      </div>
    </div>
  );
}

function ShareMock() {
  const channels = [
    { label: "Copy link", icon: Link2 },
    { label: "Social", icon: Share2 },
    { label: "Message", icon: MessageCircle },
    { label: "Email", icon: Mail },
  ];
  return (
    <div className="space-y-4 rounded-2xl bg-white/70 p-5 ring-1 ring-zinc-200">
      <MockLabel>Share your fundraiser</MockLabel>
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
        <span className="truncate text-sm font-semibold text-zinc-600">
          fund4agoodcause.com/fundraisers/your-cause
        </span>
        <span className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">
          <Copy className="h-3.5 w-3.5" />
          Copy
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {channels.map(({ label, icon: Icon }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600"
          >
            <Icon className="h-3.5 w-3.5 text-emerald-600" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PayoutMock() {
  return (
    <div className="space-y-4 rounded-2xl bg-white/70 p-5 ring-1 ring-zinc-200">
      <div className="flex items-center justify-between">
        <MockLabel>Payout account</MockLabel>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secured by Stripe
        </span>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <p className="text-sm font-black tracking-widest text-zinc-800">•••• •••• •••• 6789</p>
        <p className="mt-1 text-xs font-semibold text-zinc-500">Bank account · verified</p>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-bold text-emerald-700">
          <Lock className="h-3.5 w-3.5" />
          Next payout
        </span>
        <span className="text-sm font-black text-emerald-700">Deposited securely</span>
      </div>
    </div>
  );
}

const FUNDRAISER_STEPS: HowItWorksStep[] = [
  {
    title: "Tell your story and set your goal",
    description:
      "Add a title, write what you're raising for, and set a funding goal. A cover photo and short summary help supporters connect with your cause right away.",
    media: <CreateFormMock />,
  },
  {
    title: "Share it with your community",
    description:
      "Publish your page and send the link to friends, family, and social networks. Every share puts your campaign in front of people ready to give.",
    media: <ShareMock />,
  },
  {
    title: "Receive funds securely",
    description:
      "Donations run through encrypted, Stripe-backed checkout and pay out to your bank account, so you can put support to work without the worry.",
    media: <PayoutMock />,
  },
];

export default function HowFundraisingWorks() {
  return (
    <HowItWorks
      eyebrow="How it works"
      heading="Start strong in three simple steps"
      subheading="From your first draft to funds in your account — Fund4Good keeps every step clear and secure."
      steps={FUNDRAISER_STEPS}
    />
  );
}
