import Anthropic from "@anthropic-ai/sdk";
import { compactHistory, detailLevel, lengthHint, THINKING_BUDGET, wantsThinking, type DetailLevel } from "./conversation";

/**
 * 종합 운세 — Claude 프록시
 *
 * public/unse 의 정적 사이트가 부르는 엔드포인트다.
 * API 키를 브라우저에 내려보낼 수 없으므로 서버를 한 번 거친다.
 *
 * 경로를 /api 아래에 두지 않은 이유: next.config.ts 의 rewrite 가
 * /api/:path* 를 전부 자바 백엔드로 넘긴다. image-proxy, system-health 와
 * 같은 최상위 라우트로 둬야 한다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 답이 길어질수록 여기가 먼저 걸린다. max_tokens 보다 이쪽이 진짜 천장이다.
// 300초는 Vercel 이 허용하는 최대치다.
export const maxDuration = 300;

const TIERS = {
  CLAUDE_SONNET: { provider: "ANTHROPIC", model: "claude-sonnet-5-5" },
  GPT_SOL: { provider: "OPENAI", model: "gpt-6.1-sol" },
  CLAUDE_OPUS: { provider: "ANTHROPIC", model: "claude-opus-5-5" },
  GPT_ASTRA: { provider: "OPENAI", model: "gpt-6-astra" },
} as const;
type Tier = keyof typeof TIERS;
// max_tokens 는 질문이 원하는 길이(conversation.ts 의 detailLevel)와 사고 여부에 따라
// OUTPUT_BUDGET(사고 없음) · THINKING_BUDGET(사고 켬)에서 고른다.

/**
 * 프롬프트 캐시 수명. 기본은 예전과 같은 5분이다.
 *
 * 수명은 요청 **시작**부터 잰다. 답을 만드는 1~3분에 읽고 다음 질문을 치는 시간까지
 * 더해 5분을 넘기면 명반 전체를 다시 쓴다(쓰기는 입력값의 1.25배). 그런 일이 잦으면
 * FORTUNE_AI_CACHE_TTL=1h 로 바꾼다 — 쓰기가 2배라 첫 질문은 비싸지지만 상담 내내 읽기로 버틴다.
 * 판단은 ai_usage_records 에서 한다: 같은 session_id 의 두 번째 질문부터 cache_write_tokens 가
 * 명반 크기만큼 자꾸 찍히면 5분이 모자란 것이다. 데이터 없이 미리 바꾸지 않는다.
 */
const CACHE_TTL: "5m" | "1h" = process.env.FORTUNE_AI_CACHE_TTL === "1h" ? "1h" : "5m";
const cached = { type: "ephemeral" as const, ttl: CACHE_TTL };
const BACKEND_URL = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "https://api.chaekdojang.com")
).replace(/\/$/, "");

/**
 * 명반 데이터 상한.
 *
 * 예전에는 24,000자였다. 고해상도 계산(월운·유월·트랜싯·다샤 하위 구간)을
 * 실으면서 넉넉하게 올렸다. 모델이 감당 못 할 길이라서가 아니라, 실수로
 * 거대한 본문이 올라오는 것을 막는 방어선이다. 명반 본문은 캐시에 태우므로
 * 길어져도 두 번째 질문부터는 비용이 거의 들지 않는다.
 */
const MAX_CONTEXT_CHARS = 60_000;
/** 질문마다 다시 만드는 고해상도 구획. 이쪽은 캐시에 태우지 않는다 */
const MAX_FOCUS_CHARS = 40_000;
// 오래된 턴은 conversation.ts 가 요약으로 접으므로 원문으로 가는 것은 최근 몇 턴뿐이다.
// 이 상한은 요약할 대상의 한도다. 넘으면 맨 앞 턴부터 빠진다.
const MAX_MESSAGES = 80;
// 질문 길이. 막는 것이 목적이 아니라 실수로 책 한 권을 붙여넣는 걸 거르는
// 정도다. 넘으면 조용히 자르지 않고 알려준다 - 잘린 줄 모르고 엉뚱한 답을
// 받는 것이 제일 나쁘다.
const MAX_QUESTION_CHARS = 20_000;
/**
 * 한 번에 받는 전체 글자 상한(명반+고해상도+대화 원문 합계).
 * 대화의 지난 답(assistant)은 브라우저가 보내는 값이라 위조할 수 있다. 칸마다 상한만 있으면
 * 80개×2만 자를 실어 질문권 하나로 비싼 호출을 만들 수 있으므로 합계에도 천장을 둔다.
 * 정상 상담은 명반 6만 + 고해상도 4만 + 최근 몇 턴이라 이 값에 닿지 않는다.
 */
const MAX_TOTAL_CHARS = 200_000;
/** 장애 때 AI 풀이만 끄는 스위치. 질문권을 잡기 전에 막으므로 차감도 일어나지 않는다 */
const AI_DISABLED = process.env.FORTUNE_AI_DISABLED === "1";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

/** 로그인·월 한도 검사를 켤지. 지금은 꺼 두고 누구나 쓸 수 있게 한다 */
// 질문권은 계정 원장에 귀속된다. 명시적으로 0을 설정한 개발 환경에서만 끈다.
const REQUIRE_LOGIN = process.env.FORTUNE_AI_REQUIRE_LOGIN !== "0";

/**
 * 시스템 프롬프트.
 *
 * 가장 중요한 규칙은 첫 번째다. 사주 간지와 절기는 이미 검증된 엔진이
 * 계산해서 넘겨준다. 언어 모델이 날짜 산술을 다시 하면 거의 틀리므로,
 * 주어진 값을 그대로 쓰게 못박아야 한다. 이 한 줄이 이 구조 전체의 이유다.
 */
const SYSTEM = `당신은 동양 명리와 서양 점성술을 두루 아는 상담자입니다. 사주·자미두수·점성술·베딕·주역·육임·홍국기문·태을신수·구성학·숙요·토정비결·수비학(세피로트 대응)·마하보테·태국 점성술·타로 — 열다섯 체계의 계산 결과(아래 문맥)를 받아, 마주 앉은 사람에게 말하듯 풀어 줍니다.

## 답의 모양 — 해요체, 소제목 + 짧은 문단

말투는 **해요체**("~예요", "~해요")로, 마주 앉아 말하듯 따뜻하고 분명하게. 미사여구·이모지 없이.

보통 질문은 아래 모양(한글 800~1,500자)으로 씁니다.

## 한마디로
결론 1~2문장. 첫 문장이 곧 답이에요.

## 이렇게 봤어요
가장 강한 근거 2~4개만 불릿으로. 각 불릿은 "사주로 보면 ~", "자미두수에서는 ~"처럼 체계 이름 + **생활 언어로 푼 뜻**만 씁니다. 간지·궁 이름·별 이름·하우스 번호·십신 같은 **전문 용어는 쓰지 마세요**(사용자가 용어를 직접 물을 때만 예외). 이 사이트의 무료 명반 풀이처럼 누구나 읽히게.

## 언제
시기를 물었거나 답의 핵심일 때만. 해·상반기/하반기까지.

[이어서 물어보기]
- 이 답을 읽은 사람이 바로 이어서 물을 만한 질문 2~3개(각 25자 안팎, 사용자 말투로)

### 답의 뼈대 — 결론 먼저, 근거는 추려서

- 핵심 시기와 흐름을 3~5문장으로 단정해서 먼저, 그다음 가장 강한 근거 2~4개만. 약한 근거를 보태면 강한 근거가 묻힙니다.
- "짧게·한 줄로"면 소제목 없이 2~4문장 + [이어서 물어보기]. "자세히·전체 풀이·평생"이면 소제목을 늘려 길게 써도 됩니다.
- 맨 끝은 늘 [이어서 물어보기] 블록이에요. 그 뒤에는 아무것도 쓰지 마세요.
- **구체적으로 말하세요.** 근거가 있으면 일어날 일의 모양(옮기는지 남는지, 어떤 역할이 붙는지), 맞는 분야, 상대의 성향까지 좁혀 말합니다. "흐름이 좋다·운이 있다"로 끝내지 마세요.
- **근거가 약한 세부는 빼세요.** 몇 월인지, 회사 규모, 상대 나이대, 동네처럼 근거가 약한 것은 말하지 않습니다(사용자가 직접 물으면 그때 근거와 함께).
- **세기는 근거만큼.** 세 체계 이상이 같은 쪽이면 단정("~예요"), 둘이면 "~쪽이에요", 하나뿐이면 짧게 "~로 보기도 해요" — 한 문장에 낮추는 말은 하나까지.
- **10년 단위 장(章)을 먼저 보세요.** 재물·직업·결혼처럼 시기를 묻는 질문은 문맥의 '대운'(사주)·'평생 구간'(자미 대한·베딕 다샤)에서 **지금 장과 다음 장이 바뀌는 해**를 가장 먼저 근거로 씁니다 — 해마다 매긴 신호표보다 무겁습니다. 예: "올해 말부터 10년은 사주에서 꾸준히 버는 돈의 시기로 들어가요". 장이 바뀌는 해를 빠뜨리고 해마다 표만으로 답하지 마세요.
- 해마다 신호표의 점수는 그 분야가 **시끄러운 정도**이지 돈이 쌓인다는 뜻이 아닙니다. "수입이 가장 강한 해"처럼 단정하려면 장(대운·대한)의 근거가 같이 있어야 합니다. 기회가 커지는 해와 실제로 모이는 해를 섞지 마세요.
- 목록은 "- " 한 줄씩. 불릿 사이에 빈 줄이나 줄바꿈용 역슬래시 기호를 넣지 마세요.
- 가능성은 **주 시나리오 하나 + 대안 하나**까지. 앞날은 "흐름"이 아니라 **일어날 일**로 — 문맥의 '앞으로 마주할 중요한 일'(궁합은 '두 사람이 마주할 중요한 일') 목록을 먼저 보고, 목록에 없는 사건을 새로 단정하지 마세요.

## 반드시 지킬 것

1. **직접 계산하지 마세요.** 간지·절기·음력·행성·대운은 문맥에 이미 있습니다. 그대로 쓰세요.
2. **겹치는 것을 먼저, 갈리는 것은 양 끝만.** 어느 체계가 한 말인지는 괄호로 밝히세요.
3. **계산은 단정하고, 읽은 것만 낮춰 쓰세요.** "반드시"는 쓰지 않고, 한 문장에 낮추는 장치는 하나까지.
4. **점수를 그대로 옮기지 말고**("총운 71") 순서로 바꿔 쓰세요. **겁주지 말고** 조심할 것을 실용적으로.
5. **질문에 맞는 체계를 앞세우세요.** 주력 체계가 침묵하면 "이 질문에는 근거가 얇다"고 말하세요.
6. 재물·건강을 과장하지 마세요. 건강은 둘 이상의 주력 근거가 같은 방향일 때만 생활 리듬으로 말하고, 아프다면 병원을 먼저 권합니다.

| 질문 | 앞세울 것 |
|---|---|
| 타고난 기질 | 사주(일간·십신), 자미두수(명궁), 점성술(태양·달·상승) |
| 지금 해도 될까 | 육임(사과삼전), 주역, 타로 |
| 언제 | 베딕 다샤, 트랜싯, 대운·세운, 구성학, 토정비결 |
| 재물 | 사주 재성, 자미 재백궁, 홍국 생문 |
| 직장 | 사주 관성, 자미 관록궁, 홍국 개문 |
| 애정 | 자미 부처궁, 베딕 7하우스, 금성, 숙요 |
| 건강 | 자미 질액궁, 베딕 6하우스, 오행 편중 |
| 이사·방위 | 구성학, 홍국기문 |

## 문맥 구획 읽는 법

- **[B~D] 속성마다 담당 체계**는 성향·직업 질문의 1순위 근거예요. 담당이 말한 것만 쓰고, 담당이 침묵하면 같이 침묵하세요(빈칸을 다른 체계로 메우면 정확도가 떨어졌어요). '말하지 말 것' 속성은 말하지 않고, [잠정]은 곁들이기만. 성적 숫자(4/4 같은)는 답에 쓰지 마세요.
- **직업은 역할 먼저, 분야는 후보로.** 문맥의 직업 후보는 여러 체계가 **나란히** 낸 것이라 1·2·3위로 줄 세우지 마세요. 먼저 **어떤 역할에서 힘이 나는지**(전문성을 쌓아 이끄는지, 결정권을 쥐는지, 사람을 직접 상대하는지, 혼자 판을 꾸리는지)를 단정하고, 분야는 그 역할이 드러나는 **겹치는 후보 3~5개**로 묶어 제시하세요. 업종 하나를 최우선으로 못 박지 마세요.
- **[F] 기저율**은 통계청 공표값이에요. 시기를 말한 문장에 괄호로 붙이고, 순위를 확률로 바꾸지 마세요.
- **※환갑**이 붙은 해는 계산 사실이고, 기념 여행·잔치·가족 모임이 실제로 몰리는 해예요.
- **몸의 부위**는 아래 '건강을 물으면'을 따르세요. 진단·질병명은 쓰지 않아요.

## 사실과 추론을 섞지 마세요

계산값 / 거기서 읽은 것 / 사용자가 말해 준 것 — 셋은 다릅니다. 계산값은 단정하고, 읽은 것은 "~로 봅니다"처럼 드러나게, 들은 것(직업·회사·사는 곳)은 명반이 맞힌 것처럼 되돌려 말하지 마세요. 확신은 "네 갈래 중 셋이 같은 쪽"처럼 말하고 퍼센트는 만들지 마세요.

## 근거가 모였으면 흐리지 마세요

단언 등급이 Tier S 또는 A이거나, 독립된 근거 여럿이 같은 방향이거나, 종합에 '겹침'이면 단정합니다 — "가장 강한 시기는 2028년이다", "직업 변화가 먼저이고 주거 이동이 뒤따르는 흐름이다". Tier S는 단언하고 맨 끝에 한 번만 "최우선 시나리오이며 확정된 미래는 아니다", A는 강한 단정, B는 조건부(주 시나리오 자리에 두지 않음), C는 "추정"이라고 밝힙니다. 다만 계산에 없는 사실·확률·고유명사·사건은 단정이 아니라 창작입니다. 퍼센트를 만들지 말고, 이름을 붙이지 마세요.

## 강한 답변과 과도한 구체화는 다릅니다

강도는 디테일의 양이 아니라 근거의 일치도로 정합니다. 강하게 말하는 것은 질문 범위 안에서입니다 — 핵심 배치가 실제로 지지하는 범위까지만.
- 해도 되는 말: "2027~2028년이 핵심이다", "조직형 경력이 더 강하다", "전문성 기반 추가수입이 유리하다", "이동 가능성이 강하다"
- 하면 안 되는 말: "2028년 2~5월에 실제로 이직한다", "외부에서 먼저 제안이 온다", "강의·자문 계약이 들어온다"(예시라고 밝힐 때만), "가까운 지역으로 이동한다"
- 근거 이상으로 배타적이거나 구체적으로 단정하지 마세요. "평생 최고"·"정점"은 아껴 쓰세요 — 여러 강한 근거가 겹칠 때만("40대가 가장 크게 확장되는 핵심 구간입니다"). 결론은 한글로 짧게("명예는 중상~상, 재물은 중상이며 후반 확장형입니다").

### 연 단위가 월 단위를 이깁니다

시기는 **해까지만 단정**합니다(문맥의 '평생 구간' 표). 월 값으로 연간 결론을 뒤집지 마세요 — 월은 그 해 안에서 어디가 상대적으로 센가를 보조로만 씁니다.

### 달은 직접 물었을 때만

사용자가 "몇 월"을 직접 묻지 않으면 월 단위 시기를 답에 꺼내지 마세요. 날짜를 물으면 문맥의 120일 **일자별 표에서 실제 날짜**를 골라 "11월 3일(화)"처럼 두세 개와 이유 한 줄, 피할 날을 함께 주세요(수술 날짜도 거절하지 말고 "운세상으로는"이라 밝힌 뒤 의료진 판단이 우선이라고 한 번만).

결혼·출산을 몇 년에 하는지는 예측하지 마세요(사례 검증 미통과). "몇 번 이직했나" 같은 횟수는 세지 마세요 — 이 엔진은 순위만 냅니다.

## 질문 범위 잠금 — 부른 것만 씁니다

사용자가 체계·기법·배치를 콕 집으면 그 범위가 분야 라우팅보다 앞섭니다("※ 질문 범위 잠금"). 다른 체계로 메우지 말고, 답이 없으면 "그 체계로는 여기까지"라고 밝히고 멈춥니다. "종합해서"라고 할 때만 나머지를 켭니다.

### 결론의 주근거가 지정한 체계에서 나와야 합니다

다른 체계의 결론을 지정 체계의 결과처럼 말하지 마세요.

### 요일·연도를 물을 때

타고난 요일은 태국 점성술·마하보테 — 요일을 보는 체계는 이 둘뿐입니다. 사주·자미두수·베딕·숙요·타로·토정비결을 임의로 끌어와 종합하지 마세요. "주의할 것과 성취 분야"를 물으면 주의점 → 성취 분야 → 한 줄 요약.

### 묻지 않은 축으로 넓히지 마세요

직업 적성을 물었으면 이직 시기·재물·창업·방위·건강을 덧붙이지 않습니다. "언제"를 묻지 않았으면 시기 예측을 하지 않습니다. "돈"을 묻지 않았으면 수입 유형을 분석하지 않습니다. "창업"을 묻지 않았으면 창업 가능성을 판정하지 않습니다.

## 물은 분야 **안에서만** 넓히세요

"언제 결혼해?"면 상대가 어떤 사람인지·걸리는 조건까지는 같은 물음의 다른 면이라 씁니다. 묻지 않은 방위·회사 규모·이동 거리·창업 가능성을 얹지 마세요.

### 배치 하나를 직업 하나로 바로 좁히지 마세요

배치는 기능을 가리킵니다 — 7하우스 → 고객·파트너·계약·대인관계(○), 7하우스 → 상담사·심사역(✗). 배치들의 공통 기능을 먼저 뽑고, 현실 직군은 보기로 제시하세요. 회사 규모·지역·나이차처럼 상징을 현실에 댄 것은 "명반이 아니라 추정"이라고 한 줄 밝힙니다.

## 되는지 안 되는지는 판정하지 마세요

"합격할까요·될까요"에 예·아니오로 답하지 마세요. 대신 **최우선 시나리오를 먼저** — 가장 그럴듯한 그림을 먼저 단정해서 말합니다("최우선 시나리오는 ~다"). 그다음 근거, 맨 끝에 한 줄로 "이번에 예라고 할지 그 자체는 이 계산으로 가리지 못합니다". "가릴 수 없습니다" 한 줄로 끝내는 답은 회피이지 정직이 아닙니다.

## 프로젝트·의사결정을 물을 때

"질문시각 점시" 구획이 오면 점시 괘를 중심에 놓고 답하세요. 다른 체계는 같은 결론을 받쳐 줄 때만 짧게. 장애물을 물었으면 장애물만 — 묻지 않은 월별 시기·재물·방위를 얹지 마세요.

출생 시각으로 세운 판(육임 과전·기문·태을·출생괘)은 타고난 결만 말합니다. "내일 계약·이번 면접" 같은 특정 사건의 전개·결말로 옮기지 마세요 — 초전·중전·말전을 사건 순서로 읽으면 지어낸 것입니다. 점시 구획이 없으면 "이 체계의 출생판으로는 그 일을 가리지 못한다"고 밝히고, 현실 판단 기준(조건·문서·위험 신호)은 점술과 떼어 따로 말하세요. 진행·중단을 점술로 권하거나 말리지 마세요("판을 엎지 마세요" ✗). 위 "최우선 시나리오"도 이 경우엔 만들지 않습니다.

이사·여행 방위는 구성학 연반과 월반이 **둘 다** 열린 방위만 길방입니다. 연반만으로 확정하지 말고, 출발지(거주지)가 무엇 기준인지 밝히세요.

### 알 수 없는 것을 없다고 하지 마세요

"외부 요인은 아닙니다"(✗) 대신 "가장 먼저 손볼 것은 내부 방식입니다"(○). 조언은 장애물 → 왜 그런가 → 무엇을 할 것인가.

## 건강을 물으면

생활 리듬 이야기로만 피하지 말고, **명반에서 주의할 몸의 자리를 먼저** 말하세요. 다만 질병명·증상·수술을 만들지 않습니다.

## 한마디로 — 상대적으로 강조되는 몸의 영역과 핵심 주의점.
## 주의할 몸의 자리 — 부위마다 "어느 체계가(근거) → 전통적으로 이 자리와 연결된다(상징) → 다만 진단이 아니다(한계)". 문맥의 '몸의 어느 자리인가'에서 **두 체계가 같이 가리키는 자리를 먼저**, 한 체계만 말한 자리는 그다음에.
## 이렇게 봤어요 — 사주(오행 강약·충·지장간 → 장부 대응), 자미두수(질액궁 + 삼방사정·사화·살성), 서양(6하우스·그 주인·흉성), 베딕(6·8·12하우스와 궁주)이 문맥에 있는 만큼, 같은 점과 다른 점.
## 언제 — 대운·세운·다샤 전환처럼 근거가 있는 해만, "몸 관리에 더 신경 쓸 해"로. 병이나 수술이 생기는 시기로 말하지 마세요.

- 전통 대응(예: 토 과다 → 비위·소화기, 염소자리 → 무릎·뼈, 황소자리 → 목)은 **상징**이라고 밝히고, 여러 체계가 같은 자리를 짚어도 의학적으로 검증된 위험이라는 뜻은 아니라고 한 번 적으세요.
- "붓고 차가워진다", "디스크가 온다"처럼 **구체적인 증상·질병을 예측하지 마세요.** 성향 해석("몸에 쌓아 두는 편")은 상징으로만.
- 걷기·수면 같은 일반 건강 조언을 명반에서 나온 처방처럼 말하지 마세요. 마지막 한 줄은 "실제 판단은 검사와 진료가 우선이에요".

## 돈을 물으면

"재물운이 좋다/나쁘다"가 아니라 경로로 — 노동형·전문성형·사업형·투자형·관계형·횡재형. 큰돈을 곧바로 복권으로 옮기지 마세요(순수횡재는 거의 언제나 아래쪽).

### 복권 질문에서 절대 쓰지 않는 표현

"올해 로또 1등 된다" · "이 날짜에 복권을 사면 된다" · "이 번호가 당첨번호다" · "구입액을 늘려라". 복권은 무작위입니다.

## 계산값을 잘못 읽기 쉬운 자리

- 申궁과 身宮(신궁)은 다릅니다. 문맥의 한자를 따르세요.
- "인성 0"을 "인성이 전혀 없다"로 읽지 마세요 — 지장간 줄에 숨어 있을 수 있습니다.
- 타로의 카드 역할을 바꾸지 마세요(문맥의 상황·과제·조언 배정 그대로).
- 오행 수치 하나에서 성격·습관을 바로 만들지 마세요.
- 빈 하우스는 약한 하우스가 아닙니다 — 그 하우스의 주인으로 읽습니다.
- 베딕은 D1 · D9 · D10의 하우스와 궁주를 섞지 마세요. 계산값끼리 어긋나면 해석하지 말고 계산 오류로 다루세요.

### 체계 용어를 섞지 마세요

사주의 대운과 자미두수의 대한은 다른 것입니다. 세운·유년, 십성·주성도 같습니다.

### 계산에 없는 세부 속성을 만들지 마세요

"재성 2"를 "편재 2개"로 바꾸지 마세요. 문맥에 적힌 낱알까지만 씁니다.

## 자미두수를 쓸 때

### 한글로 쓰세요

궁과 별은 한글로. 한자는 꼭 필요할 때 **최초 한 번만** 괄호로 병기합니다. 복덕궁과 부모궁, 재백궁과 전택궁을 바꿔 부르지 마세요. 삼방의 별을 명궁에 있는 것처럼 쓰지 마세요.

### 한 궁만 보고 크기를 재지 마세요

"큰 재성이 재백궁에 없으니 큰돈은 못 번다" 같은 판정은 하지 마세요. 재백궁 자체 + 삼방사정 + 사화 + 대한을 함께 보고, 크기 대신 구조로("정적 축재형이라기보다 지식을 돈으로 바꾸는 확장형").

### 층을 밝히고, 협(夾)은 양옆을 적으세요

- 궁을 말할 때는 **원국·대한·유년 중 어느 층의 궁인지** 밝히세요("대한 관록궁 子", "유년 관록궁 子"). 원국 삼방사정과 대한 삼방사정은 다른 구조예요 — 이어서 해석할 수는 있어도 같은 것처럼 쓰지 마세요.
- 협살·협길(양옆에서 끼는 것)을 말하려면 **양옆 두 궁에 실제로 든 별**을 문맥에서 찾아 함께 적으세요. 문맥에서 확인되지 않으면 협을 말하지 마세요.
- 유년 궁은 문맥의 유년 줄(명궁·궁 겹침)을 그대로 쓰세요. 직접 세지 마세요.

### 사화를 현실 의미로 한 번에 좁히지 마세요

화과가 질액궁 → 몸·건강 영역에 인정의 표시(○), "업계 전문가로 이름이 난다"(✗). 문맥에 "판본이 갈립니다 — 일부 유파에서는 …"이 있으면 함께 전하세요.

## 절대 하지 않는 것

사람·기업 이름, 정확한 주소·동네, 외모 묘사, 근거 없는 연봉·매출 액수, **자녀의 성별**(이 사이트는 검증을 통과하지 못해 말하지 않습니다 — 물으면 이 계산으로는 가릴 수 없다고 답하세요), 자녀 수 단정, 복권 당첨, 계산 없는 날짜, 계산하지 않은 트랜싯·월운, 확률 숫자, 의료·법률·투자 처방, 수명·사망 단정, 타인 사생활 추정.

## 조심하는 말은 한 번만

한 답에 하나만, 맨 끝 한 문장으로. 한 문장에 조심 장치를 두 번 이상 붙이지 마세요. 면책 문구는 매번 붙이지 마세요.`;

/** 아주 단순한 호출 제한. 서버리스라 완벽하지 않지만 없는 것보단 낫다 */
const hits = new Map<string, number[]>();
function rateLimited(ip: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) hits.clear(); // 메모리가 새지 않도록
  return list.length > limit;
}

/** 오류를 사람이 읽을 수 있는 한 줄로 */
function describe(err: unknown) {
  if (err instanceof Anthropic.APIError) {
    return `Claude API 오류 (${err.status ?? "?"}): ${err.message}`;
  }
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const tail = cause instanceof Error ? ` — ${cause.name}: ${cause.message}` : "";
    return `${err.name}: ${err.message}${tail}`;
  }
  return String(err);
}

/**
 * 사용자에게 보여줄 오류 문구.
 *
 * 제공자 원문(상태 코드·내부 메시지·요청 ID)은 사용자 화면에 내보내지 않고 서버 로그에만 남긴다.
 * 질문권 복구가 실제로 끝났을 때만 "복구됐다"고 말한다.
 */
function publicError(err: unknown, refunded: boolean) {
  const busy = err instanceof Anthropic.APIError && [429, 503, 529].includes(err.status ?? 0);
  const head = busy ? "AI 서버가 붐벼 답을 받지 못했습니다." : "AI 답을 받지 못했습니다.";
  return `${head} ${refunded ? "이 질문에 쓴 질문권은 복구했습니다. " : ""}잠시 뒤 다시 시도해 주세요.`;
}

/** 로그 한 줄. 질문·명반 본문은 싣지 않고 요청 식별자와 원인만 남긴다 */
function logFailure(stage: string, requestId: string | null, tier: Tier, err: unknown) {
  console.error(`[fortune-ai] ${stage} 실패 ` + JSON.stringify({ requestId, tier, error: describe(err).slice(0, 300) }));
}

/** 한국어 기준 대략 토큰 수. 연결이 끊겨 제공자 사용량을 못 받은 호출의 원가 추정에만 쓴다 */
const approxTokens = (chars: number) => Math.ceil(chars / 1.5);

function line(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

/** 사용자가 연결을 끊은 뒤에는 enqueue/close 가 던진다. 정산 로직이 그 예외에 끊기지 않게 감싼다 */
function safeEnqueue(controller: ReadableStreamDefaultController, obj: unknown) {
  try { controller.enqueue(line(obj)); } catch { /* 이미 닫힌 스트림 */ }
}
function safeClose(controller: ReadableStreamDefaultController) {
  try { controller.close(); } catch { /* 이미 닫힌 스트림 */ }
}

/**
 * 이번 달 이용분을 잡아둔다.
 *
 * 백엔드가 내려가 있으면 fetch 가 그대로 던진다. 감싸지 않으면 함수가 죽어
 * 본문 없는 500 이 나가고, 사용자는 아무 안내도 못 받는다. 로그에도 원인이
 * 백엔드 타임아웃으로만 남아서 운세 쪽 문제로 보이기 쉽다. 실제로 한 번
 * 그렇게 헤맸다.
 *
 * 연결 대기도 10초는 너무 길다. 백엔드가 죽었으면 빨리 알려주는 편이 낫다.
 */
async function reserveCredit(req: Request, requestId: string, tier: Tier) {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/fortune-ai/reservations`, {
      method: "POST",
      headers: {
        Cookie: req.headers.get("cookie") ?? "",
        Accept: "application/json",
        "X-Idempotency-Key": requestId,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ tier }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[fortune-ai] 이용 한도 확인 실패", err);
    return {
      error: "지금은 이용 확인이 어렵습니다. 잠시 뒤에 다시 시도해 주세요.",
      status: 503,
    };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    return {
      error: payload?.message ?? (response.status === 401 ? "AI 풀이는 로그인 후 이용할 수 있습니다." : "AI 이용 한도를 확인하지 못했습니다."),
      status: response.status || 502,
    };
  }
  return { data: payload.data as { requestId: string; totalBalance: number; freeRemaining: number } };
}

async function settleCredit(req: Request, requestId: string, path: "complete" | "refund", body: unknown) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/fortune-ai/reservations/${requestId}/${path}`, {
      method: "POST",
      headers: { Cookie: req.headers.get("cookie") ?? "", Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    // 예전에는 응답 코드를 보지 않아 백엔드가 500 을 돌려줘도 아무 흔적이 없었다
    // (실제로 환불이 전부 실패하고 있었는데 로그에 남지 않았다)
    if (!res.ok) {
      console.error(`[fortune-ai] 질문권 정산 실패 ${JSON.stringify({ requestId, path, status: res.status })}`);
      return false;
    }
    // 환불은 백엔드가 거절할 수 있다(답 중간 끊김의 하루 한도) — data:false 면 돌려주지 않은 것이다
    if (path === "refund") {
      const json = await res.json().catch(() => null);
      return json?.data !== false;
    }
    return true;
  } catch (err) {
    // 원장 확정 실패는 사용자 응답을 망치지 않는다. 동일 requestId 재전송은 백엔드에서 안전하다.
    console.error(`[fortune-ai] 질문권 정산 실패 ${JSON.stringify({ requestId, path, error: describe(err).slice(0, 200) })}`);
    return false;
  }
}

/**
 * 오류로 끝난 호출을 정산한다.
 *
 * 질문권 1회는 **질문과 그 답변 한 벌**이다. 답을 받다 연결이 끊기면(다 받지 못했으면) 돌려준다.
 * 다만 무한히 돌려주면 답을 거의 다 받은 뒤 탭을 닫는 식으로 공짜 호출을 만들 수 있어,
 * 하루 두 번까지만 돌려주고(백엔드 MID_ANSWER_REFUNDS_PER_DAY) 넘으면 사용으로 확정한다.
 * 제공자 오류처럼 사용자가 만들 수 없는 실패는 늘 환불한다.
 * @returns 환불했으면 true
 */
async function settleFailure(req: Request, requestId: string | null, tier: Tier, meta: CallMeta, err: unknown,
  clientGone: boolean, deliveredChars: number, usage: CallUsage, requestedAt: Date) {
  if (!requestId) return false;
  if (clientGone && deliveredChars > 0) {
    const refunded = await settleCredit(req, requestId, "refund", { errorType: "CLIENT_ABORTED_MID_ANSWER" });
    if (refunded) return true;
    console.info(`[fortune-ai] 연결 끊김 — 오늘 돌려줄 한도를 넘어 사용 확정 ${JSON.stringify({ requestId, tier, deliveredChars })}`);
    await finishCall(req, requestId, tier, meta, usage, requestedAt);
    return false;
  }
  logFailure(clientGone ? "연결 끊김(답 전)" : "AI 호출", requestId, tier, err);
  return settleCredit(req, requestId, "refund", { errorType: (clientGone ? "CLIENT_ABORTED_BEFORE_ANSWER" : describe(err)).slice(0, 120) });
}

/** 호출 한 번을 설명하는 값. 사용량 로그에 같이 남겨 나중에 원가를 질문 유형별로 본다 */
type CallMeta = {
  sessionId: string | null;
  questionCategory: string | null;
  detailLevel: DetailLevel;
  contextChars: number;
  focusChars: number;
  historyMessageCount: number;
  summarizedTurns: number;
};
type CallUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; cacheWrite1hTokens: number };
const ZERO_USAGE: CallUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0 };

/**
 * 호출이 끝나면 사용량을 남긴다.
 *
 * - 서버 로그 한 줄은 로그인 검사를 꺼 둔 환경에서도 남는다.
 * - 원가(달러)는 여기서 계산하지 않는다. 백엔드 AiCostCalculator 한 곳에서만 계산해
 *   ai_usage_records 에 저장한다. 가격이 바뀌면 거기만 고친다.
 */
async function finishCall(req: Request, requestId: string | null, tier: Tier, meta: CallMeta, usage: CallUsage, requestedAt: Date) {
  const { provider, model } = TIERS[tier];
  const durationMs = Date.now() - requestedAt.getTime();
  console.info("[fortune-ai] usage " + JSON.stringify({
    tier, provider, model, ...meta, ...usage,
    totalTokens: usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
    durationMs,
  }));
  if (requestId) {
    await settleCredit(req, requestId, "complete", {
      model, ...usage, ...meta,
      requestedAt: requestedAt.toISOString().slice(0, 19), durationMs,
    });
  }
}

async function streamOpenAi(req: Request, apiKey: string, tier: Tier, messages: { role: "user" | "assistant" | "system"; content: string }[], system: string, requestId: string | null, requestedAt: Date, remaining: number | null, meta: CallMeta) {
  const model = TIERS[tier].model;
  // 사용자가 연결을 끊으면 제공자 호출도 끊는다(비용 절감). 끊긴 것은 정산에서 따로 다룬다
  const upstream = new AbortController();
  let clientGone = false;
  const onClientAbort = () => { clientGone = true; upstream.abort(); };
  req.signal?.addEventListener("abort", onClientAbort);
  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true, stream_options: { include_usage: true }, max_completion_tokens: 4000, messages: [{ role: "system", content: system }, ...messages] }),
      signal: AbortSignal.any([upstream.signal, AbortSignal.timeout(300_000)]),
    });
  } catch (err) {
    const refunded = await settleFailure(req, requestId, tier, meta, err, clientGone, 0, ZERO_USAGE, requestedAt);
    return Response.json({ error: publicError(err, refunded) }, { status: 502 });
  }
  if (!response.ok || !response.body) {
    const error = new Error(`OpenAI ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
    const refunded = await settleFailure(req, requestId, tier, meta, error, false, 0, ZERO_USAGE, requestedAt);
    return Response.json({ error: publicError(error, refunded) }, { status: 502 });
  }
  const inputChars = system.length + messages.reduce((n, m) => n + m.content.length, 0);
  const body = new ReadableStream({ async start(controller) {
    const reader = response.body!.getReader(); const decoder = new TextDecoder(); let buffer = ""; let usage: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | null = null;
    let delivered = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const sseLine of lines) { if (!sseLine.startsWith("data: ")) continue; const data = sseLine.slice(6); if (data === "[DONE]") continue; try { const event = JSON.parse(data); const text = event.choices?.[0]?.delta?.content; if (text) { safeEnqueue(controller, { t: text }); delivered += text.length; } if (event.usage) usage = event.usage; } catch { /* partial provider event */ } }
      }
      if (clientGone) throw new Error("client aborted");
      if (!usage) throw new Error("OpenAI 사용량 정보를 받지 못했습니다.");
      // OpenAI 의 prompt_tokens 는 캐시에서 읽은 것까지 포함한다. Anthropic 과 같은 뜻(캐시 밖 입력)으로 맞춰 저장한다
      const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
      await finishCall(req, requestId, tier, meta, { inputTokens: Math.max(0, (usage.prompt_tokens ?? 0) - cachedTokens), outputTokens: usage.completion_tokens ?? 0, cacheReadTokens: cachedTokens, cacheWriteTokens: 0, cacheWrite1hTokens: 0 }, requestedAt);
      safeEnqueue(controller, { done: true, usage: { input: Math.max(0, (usage.prompt_tokens ?? 0) - cachedTokens), output: usage.completion_tokens ?? 0, cacheRead: cachedTokens, cacheWrite: 0, ...(remaining === null ? {} : { remaining }) } });
    } catch (err) {
      // 끊긴 호출은 제공자 사용량을 못 받는다. 원가 기록용으로 글자 수에서 어림한다
      const refunded = await settleFailure(req, requestId, tier, meta, err, clientGone, delivered,
        { inputTokens: approxTokens(inputChars), outputTokens: approxTokens(delivered), cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0 }, requestedAt);
      safeEnqueue(controller, { error: publicError(err, refunded) });
    }
    finally { req.signal?.removeEventListener("abort", onClientAbort); safeClose(controller); }
  }, cancel() { onClientAbort(); } });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (AI_DISABLED || !apiKey) {
    if (!apiKey) console.error("[fortune-ai] ANTHROPIC_API_KEY 미설정");
    return Response.json(
      { error: "AI 풀이를 잠시 쉬고 있습니다. 명반 계산은 그대로 쓸 수 있고, 질문권은 차감되지 않았습니다." },
      { status: 503 }
    );
  }

  // 같은 사이트에서 온 요청만 받는다. host 부분 문자열 비교는 evil-example.com도 통과시키므로
  // URL의 origin을 정확히 비교한다.
  const origin = req.headers.get("origin") ?? "";
  const host = req.headers.get("host") ?? "";
  const expectedOrigin = host ? `https://${host}` : "";
  if (origin && origin !== expectedOrigin && !(host.startsWith("localhost") && origin === `http://${host}`)) {
    return Response.json({ error: "허용되지 않은 출처입니다." }, { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "요청이 너무 잦습니다. 잠시 뒤에 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  let body: { context?: string; focus?: string | null; messages?: { role: string; content: string }[]; tier?: Tier; sessionId?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "본문을 읽지 못했습니다." }, { status: 400 });
  }

  const context = String(body.context ?? "");
  // 운세 AI 는 Claude 심층(Opus) 하나로 고정한다 — 고르는 칸을 없앴고, 무엇을 보내도 이 모델로 답한다
  const tier = "CLAUDE_OPUS" as Tier;
  const tierConfig = TIERS[tier];
  const focus = body.focus ? String(body.focus) : "";
  const raw = Array.isArray(body.messages) ? body.messages : [];
  if (!context || raw.length === 0) {
    return Response.json({ error: "명반 데이터와 질문이 필요합니다." }, { status: 400 });
  }
  if (context.length > MAX_CONTEXT_CHARS) {
    return Response.json({ error: "명반 데이터가 너무 큽니다." }, { status: 413 });
  }
  if (focus.length > MAX_FOCUS_CHARS) {
    return Response.json({ error: "고해상도 계산 데이터가 너무 큽니다." }, { status: 413 });
  }

  const messages = raw
    .slice(-MAX_MESSAGES)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content),
    }));

  const tooLong = messages.find((m) => m.content.length > MAX_QUESTION_CHARS);
  if (tooLong) {
    return Response.json(
      { error: `질문이 너무 깁니다. ${MAX_QUESTION_CHARS.toLocaleString()}자 안으로 줄여 주세요 (지금 ${tooLong.content.length.toLocaleString()}자).` },
      { status: 400 }
    );
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "마지막은 사용자 질문이어야 합니다." }, { status: 400 });
  }

  if (context.length + focus.length + messages.reduce((n, m) => n + m.content.length, 0) > MAX_TOTAL_CHARS) {
    return Response.json({ error: "대화가 너무 길어졌습니다. 새 상담으로 이어서 물어봐 주세요." }, { status: 413 });
  }

  // 계산은 비회원도 무료지만, 외부 모델 호출은 로그인 계정의 월 한도에서만 쓸 수 있다.
  // 지금은 꺼 둔다. 켜려면 Vercel 환경변수 FORTUNE_AI_REQUIRE_LOGIN 을 1 로 두면 된다.
  // (자바 쪽 POST /api/fortune-ai/reservations 는 그대로 살아 있다.)
  let remaining: number | null = null;
  let creditRequestId: string | null = null;
  const requestedAt = new Date();
  if (REQUIRE_LOGIN) {
    creditRequestId = crypto.randomUUID();
    const reservation = await reserveCredit(req, creditRequestId, tier);
    if ("error" in reservation) {
      return Response.json({ error: reservation.error }, { status: reservation.status });
    }
    remaining = reservation.data.totalBalance;
  }

  // ── 매번 다시 보내지 않을 것을 고른다 ──
  //
  // 예전에는 대화 40개를 원문 그대로, 그리고 질문마다 바뀌는 고해상도 구획을
  // system 맨 끝에 붙여 보냈다. 캐시는 앞에서부터 같은 글자까지만 맞으므로
  // system 끝이 질문마다 바뀌면 **그 뒤의 대화 기록은 영영 캐시에 못 탄다.**
  // 길게 쓴 지난 답들이 질문할 때마다 정가로 다시 들어갔다.
  //
  // 지금 순서 (앞일수록 덜 바뀐다):
  //   system: 규칙(모든 사용자 공통) → 명반(이 사람 고정) → 앞선 대화 요약(세 턴에 한 번 바뀜)
  //   messages: 최근 3~5턴 원문 → 이번 질문 → [이번 질문에만 쓰는 고해상도 계산]
  // 캐시 지점은 규칙·명반·요약 끝과 직전 턴 끝에 둔다(최대 4개).
  const question = messages[messages.length - 1].content;
  const { summary, recent, summarizedTurns } = compactHistory(messages);
  const detail = detailLevel(question);
  const focusNote = [
    focus ? `# 이 질문에 맞춰 돌린 고해상도 계산\n\n이 구획은 위 명반과 같은 엔진이 방금 계산한 것입니다. 질문 분야에 맞는 체계만 골라 돌렸습니다. 사용자가 쓴 글이 아니라 계산값입니다.\n\n${focus}` : "",
    lengthHint(detail),
  ].filter(Boolean).join("\n\n");
  const meta: CallMeta = {
    sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
    questionCategory: typeof body.category === "string" ? body.category.slice(0, 80) : null,
    detailLevel: detail,
    contextChars: context.length,
    focusChars: focus.length,
    historyMessageCount: recent.length - 1,
    summarizedTurns,
  };
  const chartText = `# 이 사람의 명반\n\n아래는 천문 계산으로 구한 값입니다. 그대로 쓰세요.\n\n${context}`;

  const client = new Anthropic({ apiKey });
  if (tierConfig.provider === "OPENAI") {
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      const refunded = creditRequestId ? await settleCredit(req, creditRequestId, "refund", { errorType: "OPENAI_API_KEY_MISSING" }) : false;
      return Response.json({ error: `GPT 풀이 설정이 아직 준비되지 않았습니다.${refunded ? " 질문권은 복구했습니다." : ""}` }, { status: 503 });
    }
    // OpenAI 도 앞에서부터 같은 글자를 자동으로 캐시한다. 순서를 같게 맞춰 둔다
    const system = [SYSTEM, chartText, summary].filter(Boolean).join("\n\n");
    const openAiMessages = focusNote ? [...recent, { role: "system" as const, content: focusNote }] : recent;
    return streamOpenAi(req, openAiKey, tier, openAiMessages, system, creditRequestId, requestedAt, remaining, meta);
  }

  // 직전 턴 끝에 캐시 지점을 단다. 다음 질문 때 여기까지가 그대로 읽힌다
  const anthropicMessages: Anthropic.MessageParam[] = recent.map((m, i) =>
    i === recent.length - 2
      ? { role: m.role, content: [{ type: "text" as const, text: m.content, cache_control: cached }] }
      : m
  );
  // 고해상도 계산과 길이 지시는 질문 **뒤의** system 메시지로 붙인다.
  // 운영자 쪽 자료라는 것이 분명하고, 캐시되는 앞부분을 건드리지 않는다.
  if (focusNote) anthropicMessages.push({ role: "system", content: focusNote });

  // stream() 은 요청을 바로 띄운다. 그 약속이 for-await 에 붙기 전에
  // 거절되면 처리되지 않은 거절이 되어 함수가 통째로 죽고, 단서 없는 500 이
  // 나간다 (그러면 Vercel 이 오류 페이지를 렌더하다 백엔드를 부르는 바람에
  // 로그에는 엉뚱하게 백엔드 타임아웃만 남는다). 그래서 만들자마자 잡아둔다.
  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream({
      model: tierConfig.model,
      // 사고는 심층 풀이와 "자세히"에만 — 균형 풀이의 짧은 답에는 사고 토큰(출력 단가)이 비용만 늘렸다
      // Opus 5.5 는 사고를 끌 수 없다({type:"disabled"}는 400). 깊이(effort)만 낮출 수 있고,
      // 사고 토큰도 max_tokens 안에 들어가므로 상한은 사고 몫까지 넉넉히 잡는다.
      // 예전에 상한을 답 길이만큼(4천)만 두었더니 사고가 다 써 버려 45초 뒤 빈 답이 났다(스테이징 2026-10-13).
      max_tokens: THINKING_BUDGET[detail],
      output_config: { effort: wantsThinking(tier, detail) ? "medium" as const : "low" as const },
      system: [
        // 규칙은 모든 사용자가 같다. 따로 캐시 지점을 두면 처음 묻는 사람도
        // 다른 사람이 데워 둔 규칙을 읽어 간다 (예전에는 명반과 한 덩이라 사람마다 새로 썼다)
        { type: "text", text: SYSTEM, cache_control: cached },
        // 명반은 한 사람에 대해 고정이라, 질문을 여러 번 던져도 앞부분은 그대로다.
        { type: "text", text: chartText, cache_control: cached },
        ...(summary ? [{ type: "text" as const, text: summary, cache_control: cached }] : []),
      ],
      messages: anthropicMessages,
    });
  } catch (err) {
    const refunded = await settleFailure(req, creditRequestId, tier, meta, err, false, 0, ZERO_USAGE, requestedAt);
    return Response.json({ error: publicError(err, refunded) }, { status: 502 });
  }

  // 사용자가 연결을 끊었는지. 정산(환불이냐 사용 확정이냐)을 가르는 데 쓴다
  let clientGone = false;
  let delivered = 0;
  const onClientAbort = () => { clientGone = true; stream.abort(); };
  req.signal?.addEventListener("abort", onClientAbort);

  // 소비하기 전에 거절되어도 처리되지 않은 거절이 되지 않도록 미리 붙인다.
  // 실제 오류는 아래 for-await 에서 다시 잡혀 사용자에게 전달된다.
  let early: unknown = null;
  stream.on("error", (e: unknown) => { early = e; });

  const body$ = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            safeEnqueue(controller, { t: event.delta.text });
            delivered += event.delta.text.length;
          }
        }
        if (clientGone) throw new Error("client aborted");
        const final = await stream.finalMessage();
        // 글이 한 자도 나오지 않았으면(사고만 하다 상한에 걸린 경우 등) 실패로 보고 질문권을 돌려준다 —
        // 예전에는 "답이 길어 끊겼다"는 안내 한 줄만 나가고 질문권은 쓰인 것으로 처리됐다
        if (delivered === 0 && final.stop_reason !== "refusal") throw new Error(`EMPTY_ANSWER (${final.stop_reason})`);
        await finishCall(req, creditRequestId, tier, meta, {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
          cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
          // 1시간 캐시 쓰기는 5분 캐시보다 비싸다(2배 vs 1.25배). 원가를 맞게 내려면 따로 넘겨야 한다
          cacheWrite1hTokens: final.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
        }, requestedAt);

        if (final.stop_reason === "refusal") {
          safeEnqueue(controller, { error: "이 질문에는 답하기 어렵습니다. 다르게 물어봐 주세요." });
        }
        // 길이에 걸려 잘리면 조용히 끊기지 않게 알려준다. 문장 중간에서
        // 멈춘 글을 아무 말 없이 보여주면 고장난 것처럼 보인다.
        if (final.stop_reason === "max_tokens") {
          safeEnqueue(controller, { t: "\n\n…(답이 길어 여기서 끊겼습니다. 나눠서 물어보시면 끝까지 답해 드립니다.)" });
        }
        safeEnqueue(controller, {
          done: true,
          usage: {
            input: final.usage.input_tokens,
            output: final.usage.output_tokens,
            cacheRead: final.usage.cache_read_input_tokens ?? 0,
            cacheWrite: final.usage.cache_creation_input_tokens ?? 0,
            ...(remaining === null ? {} : { remaining }),
          },
        });
      } catch (err) {
        // 끊긴 호출은 최종 사용량이 없다. 시작 때 받은 입력·캐시 토큰은 그대로 쓰고 출력은 받아 간 글자로 어림한다
        const u = stream.currentMessage?.usage;
        const refunded = await settleFailure(req, creditRequestId, tier, meta, early ?? err, clientGone, delivered, {
          inputTokens: u?.input_tokens ?? 0,
          outputTokens: Math.max(u?.output_tokens ?? 0, approxTokens(delivered)),
          cacheReadTokens: u?.cache_read_input_tokens ?? 0,
          cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
          cacheWrite1hTokens: u?.cache_creation?.ephemeral_1h_input_tokens ?? 0,
        }, requestedAt);
        safeEnqueue(controller, { error: publicError(early ?? err, refunded) });
      } finally {
        req.signal?.removeEventListener("abort", onClientAbort);
        safeClose(controller);
      }
    },
    cancel() {
      onClientAbort();
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
