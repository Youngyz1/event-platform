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
    <span className={`inline-flex items-center gap-1 sm:gap-2 ${className}`}>
      <img
        src="/logo.jpg"
        alt="Fund4Good Logo"
        className="h-7 w-7 shrink-0 sm:h-8 sm:w-8 object-contain rounded-md"
      />
      {showName && (
        <span className={`font-black tracking-tight ${textClassName}`}>
          Fund4Good
        </span>
      )}
    </span>
  );
}

