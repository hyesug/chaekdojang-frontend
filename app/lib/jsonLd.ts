/**
 * 구조화 데이터(JSON-LD)를 <script type="application/ld+json"> 안에 넣을 문자열로 바꾼다.
 * JSON.stringify 는 "<" 를 그대로 두므로, 독후감 본문에 "</script>" 가 있으면 태그가 닫히고
 * 뒤의 글이 HTML 로 실행될 수 있다. "<" 를 < 로 바꿔 막는다(Next.js JSON-LD 안내와 같은 방식).
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
