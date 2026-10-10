import { SITE_URL } from "../lib/serverApi";
import { IS_PRODUCTION } from "../lib/deployEnv";

/**
 * /llms.txt — AI 검색·답변 도구에 사이트를 요약해 주는 파일(https://llmstxt.org 관례).
 * 운영에서만 내보낸다. staging·개발에서는 404.
 */
export function GET() {
  if (!IS_PRODUCTION) return new Response("Not Found", { status: 404 });

  const body = `# 책도장

> 읽은 책에 나만의 감상을 찍는 독서 기록 SNS입니다. 독후감을 쓰고, 읽은 책을 서재에 모으고, 다른 독자의 감상과 책 취향을 나눕니다. 무료 종합 운세(15가지 점술 체계 비교)도 제공합니다.

## 주요 페이지

- [피드](${SITE_URL}/): 최근 공개 독후감
- [책 검색](${SITE_URL}/search?tab=books): 책을 찾아 독후감을 쓰거나 서재에 담기
- [책 상세](${SITE_URL}/books/): 한 책에 대한 독자들의 독후감·한 줄 감상·감정 키워드
- [독후감](${SITE_URL}/reviews/): 개별 공개 독후감
- [독서모임](${SITE_URL}/groups): 함께 읽은 책과 독후감을 모으는 모임
- [종합 운세](${SITE_URL}/unse): 생년월일시로 사주·자미두수·서양 점성술·베딕 점성술 등 15가지 체계를 한 번에 계산해 겹치는 것과 갈리는 것을 비교하는 무료 도구

## 종합 운세에 대해

- 사주, 자미두수, 서양 점성술, 베딕(인도) 점성술, 주역, 육임, 홍국기문, 태을신수, 구성학, 숙요, 토정비결, 카발라(수비학), 마하보테, 태국 점성술, 타로의 15가지 체계를 함께 계산합니다.
- 절기·진태양시·서머타임(한국 1948~1960, 1987~1988)·한국 표준시 변경 이력을 반영해 명반을 세웁니다.
- 계산은 사용자의 브라우저 안에서 이뤄지며, 출생 정보는 로그인한 사용자가 저장을 선택했을 때만 저장됩니다.
- 시기 풀이는 실제 사례로 검증한 체계를 분야별로 골라 쓰며, 결과는 참고용입니다.

## 정책

- [이용약관](${SITE_URL}/terms)
- [개인정보처리방침](${SITE_URL}/privacy)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
