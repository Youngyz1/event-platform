import Link from "next/link";

type FundraiserCardProps = {
  title: string;
  raised: number;
  goal: number;
  image: string;
  slug: string;
};

export default function FundraiserCard({ title, raised, goal, image, slug }: FundraiserCardProps) {
  const progress = goal ? Math.min(Math.round((raised / goal) * 100), 100) : 0;

  return (
    <Link href={`/fundraisers/${slug}`}>
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-lg transition cursor-pointer">
        <div className="h-56 w-full bg-zinc-100">
          <img
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="p-5">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-zinc-600 mt-3">
            ${raised.toLocaleString()} raised of ${goal.toLocaleString()}
          </p>
          <div className="w-full h-3 bg-zinc-200 rounded-full mt-4 overflow-hidden">
            <div className="bg-green-500 h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <button className="mt-6 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl font-semibold transition w-full">
            Donate Now
          </button>
        </div>
      </div>
    </Link>
  );
}
