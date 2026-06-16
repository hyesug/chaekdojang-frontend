"use client";

type Props = {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  xs: "w-6 h-6 text-[9px]",
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-lg",
  lg: "w-16 h-16 text-xl",
};

export default function ProfileAvatar({ src, name, size = "md", className = "" }: Props) {
  return (
    <div
      className={`${sizeClass[size]} rounded-full bg-cream-100 border border-brown-200 flex-shrink-0 overflow-hidden flex items-center justify-center text-brown-700 font-bold ${className}`}
      aria-label={`${name} 프로필 이미지`}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="inline-flex h-[72%] w-[72%] items-center justify-center rounded-full border-2 border-red-800 text-red-800 font-serif font-extrabold leading-none rotate-[-9deg]">
          冊
        </span>
      )}
    </div>
  );
}
