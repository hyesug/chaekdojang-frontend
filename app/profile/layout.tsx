import ReadingGoalCard from "./ReadingGoalCard";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <ReadingGoalCard />
      </div>
      {children}
    </>
  );
}
