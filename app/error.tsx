"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="cdj-page cdj-page--reading" role="alert">
      <p className="cdj-kicker">Archive note</p>
      <h1 className="cdj-title mt-3">기록을 불러오지 못했어요.</h1>
      <p className="mt-5 text-brown-500">잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 알려주세요.</p>
      <button className="cdj-button cdj-button--primary mt-8" type="button" onClick={reset}>다시 시도</button>
    </section>
  );
}
