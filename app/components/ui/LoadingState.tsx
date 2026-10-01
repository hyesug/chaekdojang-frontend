export function LoadingState({ label = "기록을 불러오는 중입니다" }: { label?: string }) {
  return <div className="py-10 text-center text-sm text-brown-500" aria-live="polite" aria-busy="true">{label}</div>;
}
