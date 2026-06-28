type ReadingGoal = {
  year: number;
  targetCount: number;
  finishedCount: number;
  progressPercent: number;
  remainingCount: number;
} | null;

type Props = {
  goal: ReadingGoal;
  emptyText?: string;
  compact?: boolean;
};

export default function ReadingGoalProgress({ goal, emptyText = "아직 설정한 독서 목표가 없어요.", compact = false }: Props) {
  if (!goal) {
    return (
      <div className={`${compact ? "rounded-lg p-3" : "rounded-2xl p-5"} border border-cream-200 bg-white text-sm text-brown-400`}>
        {emptyText}
      </div>
    );
  }

  const progress = Math.max(0, Math.min(100, goal.progressPercent));

  return (
    <div className={`${compact ? "rounded-lg bg-cream-50 p-3" : "rounded-2xl bg-white p-5 shadow-sm"} border border-cream-200`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-brown-400">{goal.year}년 독서 목표</p>
          <p className={`mt-1 font-serif font-bold text-brown-800 ${compact ? "text-lg" : "text-xl"}`}>
            {goal.finishedCount}권 / {goal.targetCount}권
          </p>
        </div>
        <div className="rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-brown-600">
          {progress}%
        </div>
      </div>

      <div className={`${compact ? "mt-3" : "mt-4"} h-2 overflow-hidden rounded-full bg-cream-100`}>
        <div className="h-full rounded-full bg-brown-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <p className={`${compact ? "mt-2 text-xs" : "mt-3 text-sm"} text-brown-500`}>
        {goal.remainingCount > 0
          ? `목표까지 ${goal.remainingCount}권 남았어요.`
          : "올해 독서 목표를 달성했어요."}
      </p>
    </div>
  );
}
