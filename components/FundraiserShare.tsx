"use client";

import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";
import { useState } from "react";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=1200&auto=format&fit=crop";

export default function FundraiserShare({
  title,
  imageUrl,
}: {
  title: string;
  imageUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function openShare(target: "whatsapp" | "facebook" | "twitter") {
    const encodedUrl = encodeURIComponent(window.location.href);
    const encodedTitle = encodeURIComponent(title);
    const links = {
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    };

    window.open(links[target], "_blank", "noopener,noreferrer");
  }

  return (
    <section className="border-b border-zinc-200 pb-8">
      <h2 className="text-2xl font-bold text-zinc-950 break-words">Sharing helps more than you think</h2>
      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        <img
          src={imageUrl || FALLBACK_IMAGE}
          alt={title}
          className="aspect-[16/9] w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => openShare("whatsapp")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => openShare("facebook")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
        >
          <Share2 className="h-4 w-4" />
          Facebook
        </button>
        <button
          type="button"
          onClick={() => openShare("twitter")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
        >
          <Send className="h-4 w-4" />
          Twitter
        </button>
      </div>
    </section>
  );
}
