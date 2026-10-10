export default function Loading() {
  return (
    <section className="cdj-page cdj-page--reading" aria-label="페이지를 불러오는 중입니다" aria-busy="true">
      <div className="cdj-skeleton h-3 w-24 rounded" />
      <div className="cdj-skeleton mt-4 h-11 w-3/4 rounded" />
      <div className="cdj-skeleton mt-10 h-40 w-full rounded-lg" />
    </section>
  );
}
