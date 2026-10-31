import { SITE_URL } from "../lib/serverApi";
import { IS_PRODUCTION } from "../lib/deployEnv";
import { ABOUT_FAQ, ABOUT_FEATURES, ABOUT_SUMMARY, ABOUT_UPDATED_AT } from "../about/content";
import { GUIDES } from "../guides/content";

/**
 * /llms.txt — AI 검색·답변 도구에 사이트를 요약해 주는 파일(https://llmstxt.org 관례).
 * 기능 설명은 서비스 소개(/about)와 같은 문구(app/about/content.ts)를 써서 두 곳이 어긋나지 않게 한다.
 * 운영에서만 내보낸다. staging·개발에서는 404.
 */
export function GET() {
  if (!IS_PRODUCTION) return new Response("Not Found", { status: 404 });

  const features = ABOUT_FEATURES.map(
    (feature) => `- [${feature.title}](${SITE_URL}/about#${feature.id}): ${feature.summary}`,
  ).join("\n");
  const faq = ABOUT_FAQ.map((item) => `- ${item.question} ${item.answer}`).join("\n");
  const guides = GUIDES.map(
    (guide) => `- [${guide.title}](${SITE_URL}/guides/${guide.slug}): ${guide.summary}`,
  ).join("\n");

  const body = `# 책도장

> ${ABOUT_SUMMARY}

책도장은 한국어 웹 서비스입니다. 앱스토어 앱은 없고, 휴대폰 브라우저에서 홈 화면에 추가해 앱처럼 쓸 수 있습니다. 이 요약의 기능 설명은 ${ABOUT_UPDATED_AT} 기준입니다.

## 서비스 소개

- [책도장 서비스 소개](${SITE_URL}/about): 누구를 위한 서비스인지, 주요 기능, 다른 독서 기록 방법과의 차이, 시작하는 방법, 자주 묻는 질문

## 주요 기능

${features}

## 독서 가이드

${guides}

## 자주 묻는 질문

${faq}

## 주요 페이지

- [피드](${SITE_URL}/): 최근 공개 독후감
- [독후감 둘러보기](${SITE_URL}/explore): 공개 독후감을 최신순·별점순·인기순으로 보기
- [책 검색](${SITE_URL}/search?tab=books): 책을 찾아 독후감을 쓰거나 서재에 담기
- [독서모임](${SITE_URL}/groups): 함께 읽은 책과 독후감을 모으는 모임
- [독후감 공모전](${SITE_URL}/contests): 도서관·출판사와 책도장이 여는 독후감 공모전
- 책 상세(${SITE_URL}/books/책-주소): 한 책에 대한 독자들의 독후감·한 줄 감상·감정 키워드
- 공개 독후감(${SITE_URL}/reviews/번호): 독자 한 명이 쓴 독후감
- [종합 운세](${SITE_URL}/unse): 생년월일시로 사주·자미두수·서양 점성술·베딕 점성술 등 15가지 체계를 한 번에 계산해 겹치는 것과 갈리는 것을 비교하는 도구

## 종합 운세에 대해

- 사주, 자미두수, 서양 점성술, 베딕(인도) 점성술, 주역, 육임, 홍국기문, 태을신수, 구성학, 숙요, 토정비결, 수비학(세피로트 대응), 마하보테, 태국 점성술, 타로의 15가지 체계를 함께 계산합니다.
- 절기·진태양시·서머타임(한국 1948~1960, 1987~1988)·한국 표준시 변경 이력을 반영해 명반을 세웁니다.
- 계산은 사용자의 브라우저 안에서 이뤄지며, 출생 정보는 로그인한 사용자가 저장을 선택했을 때만 저장됩니다.
- 시기 풀이는 실제 사례로 검증한 체계를 분야별로 골라 쓰며, 결과는 참고용입니다.

## 정책

- [이용약관](${SITE_URL}/terms)
- [개인정보처리방침](${SITE_URL}/privacy)
- [결제·환불 안내](${SITE_URL}/payment-info)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
