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
        <div className="h-48 w-full bg-zinc-100 sm:h-56">
          <img
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="p-5 flex flex-col justify-between flex-1">
          <div>
            <h3 className="text-lg font-black tracking-tight text-zinc-950 sm:text-xl">{title}</h3>
            <p className="text-sm font-semibold text-zinc-500 mt-2.5">
              <span className="font-bold text-zinc-900">${raised.toLocaleString()}</span> raised of <span className="font-bold text-zinc-900">${goal.toLocaleString()}</span>
            </p>
            <div className="w-full h-2 bg-zinc-100 rounded-full mt-3 overflow-hidden border border-zinc-200/50">
              <div className="bg-green-500 h-full transition-all rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-sm transition w-full text-center">
            Donate Now
          </div>
        </div>
      </div>
    </Link>
  );
}
