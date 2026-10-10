import { Star } from "lucide-react";

type StarRatingProps = {
  rating: number;
  size?: number;
  className?: string;
};

// 별점은 글자(★) 대신 같은 모양의 아이콘으로 그려 글꼴마다 모양이 달라지지 않게 한다.
export default function StarRating({ rating, size = 14, className = "" }: StarRatingProps) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`별점 5점 중 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={1.5}
          aria-hidden="true"
          className={n <= value ? "fill-star text-star" : "fill-cream-200 text-cream-300"}
        />
      ))}
    </span>
  );
}

export function StarInput({
  rating,
  onChange,
  size = 22,
}: {
  rating: number;
  onChange: (rating: number) => void;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" role="radiogroup" aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === rating}
          aria-label={`${n}점`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star
            size={size}
            strokeWidth={1.5}
            aria-hidden="true"
            className={n <= rating ? "fill-star text-star" : "fill-cream-200 text-cream-300"}
          />
        </button>
      ))}
    </span>
  );
}
