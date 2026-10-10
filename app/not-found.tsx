import Link from "next/link";

export default function NotFound() {
  return (
    <section className="cdj-page cdj-page--reading">
      <p className="cdj-kicker">Archive note · 404</p>
      <h1 className="cdj-title mt-3">찾으시는 기록을 찾지 못했어요.</h1>
      <p className="mt-5 text-brown-500">주소가 바뀌었거나, 더 이상 공개되지 않은 기록일 수 있습니다.</p>
      <Link className="cdj-button cdj-button--primary mt-8" href="/">피드로 돌아가기</Link>
    </section>
  );
}
