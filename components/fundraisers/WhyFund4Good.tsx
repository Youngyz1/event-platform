import Link from "next/link";
import CoverageBand from "@/components/marketing/CoverageBand";

/**
 * Fundraisers "we've got you covered" band. Supplies the copy and real inline
 * links to the generic <CoverageBand>.
 *
 * The "Read the FAQ" link targets the in-page `#faq` anchor, which is
 * <FundraiserFaq> further down this same page. That section must keep
 * `id="faq"` or this link stops resolving.
 *
 * The two browse links point at /campaigns, NOT the homepage. They previously
 * used `/?filter=…`, but the homepage only reads `q`, `sort` and `categories`
 * — `filter` was ignored, so both links simply reloaded the homepage. Only
 * /campaigns resolves `filter`, via resolveSmartFilter().
 */
export default function WhyFund4Good() {
  return (
    <CoverageBand
      pill="We've got you covered"
      headlineLines={["Everything you need to launch,", "grow, and fund your cause."]}
      stillHaveQuestions={{ label: "Read the FAQ", href: "#faq" }}
    >
      From{" "}
      <Link href="/campaigns?filter=trending">trending campaigns</Link>{" "}
      building real momentum to{" "}
      <Link href="/campaigns?filter=just-launched">newly launched causes</Link>{" "}
      finding their first backers, Fund4Good hands every organizer the tools to
      go from idea to funded. When you&apos;re ready,{" "}
      <Link href="/create-fundraiser">start your fundraiser</Link> — it takes
      just minutes.
    </CoverageBand>
  );
}
