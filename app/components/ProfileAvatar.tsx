"use client";

type Props = {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClass = {
  xs: "w-7 h-7 text-[11px]",
  sm: "w-9 h-9 text-sm",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
  xl: "w-20 h-20 text-2xl",
};

// 사진이 없을 때는 닉네임 첫 글자를 팔레트 안의 차분한 색 위에 올린다.
// 같은 닉네임은 늘 같은 색이 나오도록 글자 코드로 색을 고른다.
const tones = [
  "bg-[#DCE7E1] text-[#174A46]",
  "bg-[#E6E1D3] text-[#5E4B22]",
  "bg-[#F0E0E3] text-[#65202E]",
  "bg-[#DDE4EA] text-[#24414F]",
  "bg-[#E4E8DA] text-[#3E5326]",
];

function toneFor(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0) ?? 0;
  return tones[sum % tones.length];
}

export default function ProfileAvatar({ src, name, size = "md", className = "" }: Props) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`${sizeClass[size]} relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${src ? "bg-cream-200" : toneFor(name)} ${className}`}
      aria-label={`${name} 프로필 이미지`}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/5" aria-hidden="true" />
    </div>
  );
}
