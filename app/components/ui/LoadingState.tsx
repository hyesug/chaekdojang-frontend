export function LoadingState({ label = "기록을 불러오는 중입니다" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-sage-600" aria-live="polite" aria-busy="true">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream-300 border-t-brown-700" aria-hidden="true" />
      {label}
    </div>
  );
}

// 목록이 들어올 자리를 미리 보여주는 뼈대. 글자 대신 모양으로 기다림을 알린다.
export function ReviewCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="cdj-card p-5">
          <div className="flex items-center gap-2">
            <div className="cdj-skeleton h-7 w-7 rounded-full" />
            <div className="cdj-skeleton h-3 w-24" />
          </div>
          <div className="mt-4 flex gap-4">
            <div className="cdj-skeleton h-24 w-16" />
            <div className="flex-1 space-y-2.5 pt-1">
              <div className="cdj-skeleton h-4 w-2/5" />
              <div className="cdj-skeleton h-3 w-1/4" />
              <div className="cdj-skeleton h-3 w-20" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="cdj-skeleton h-3 w-full" />
            <div className="cdj-skeleton h-3 w-11/12" />
            <div className="cdj-skeleton h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
