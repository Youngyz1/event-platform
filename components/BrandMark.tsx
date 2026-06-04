type BrandMarkProps = {
  showName?: boolean;
  className?: string;
  textClassName?: string;
};

export default function BrandMark({
  showName = true,
  className = "",
  textClassName = "",
}: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-8 w-8 shrink-0"
        fill="none"
      >
        <path
          d="M8 7h12.5c2 0 3.5 1.5 3.5 3.4s-1.5 3.4-3.5 3.4H16l8.2 6.7c1.6 1.3 1.8 3.5.5 5.1-1.3 1.5-3.6 1.7-5.2.4L6.4 15.2A4.6 4.6 0 0 1 8 7Z"
          fill="#f2543d"
        />
        <path
          d="M8.6 17.5h5.8l-4.7 4.1c-1.5 1.3-3.8 1.1-5.1-.4-1.3-1.5-1.1-3.8.4-5.1l3.6-3.1v4.5Z"
          fill="#f2543d"
        />
      </svg>
      {showName && (
        <span className={`font-black tracking-tight ${textClassName}`}>
          EventBrithe
        </span>
      )}
    </span>
  );
}
