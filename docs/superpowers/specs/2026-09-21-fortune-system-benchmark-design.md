# 핵심 운세 체계 백테스트 설계

## 목표

기존 운세 산법, UI, 가중치, 합의도, LLM 문장을 바꾸지 않고 사주·자미두수·서양점성술·베딕이 각 사건의 시기를 얼마나 높게 점수화했는지 재현 가능하게 측정한다.

## 입력과 범위

새 벤치마크는 `validation-data/cases.json`의 배열을 받는다. 각 사람은 익명 `id`, `profile`, 사건 배열을 가지며 사건은 `domain`, `type`, `date` (`YYYY-MM`), 선택 `toleranceMonths`를 가진다. 기존 `validation/cases.json` 및 `blind-validate.mjs` 형식은 호환하지 않고 변경하지 않는다.

사건마다 기본 비교 구간은 실제 달 기준 전후 18개월을 포함하는 37개 달이다. 선택 옵션으로 최대 전후 30개월(61개 달)까지 늘릴 수 있다. 기준 달은 기존 `monthsOfYear()`가 만드는 절기월이며, 사건의 양력 `YYYY-MM`은 그 달에 시작하는 절기월이 아닌 달력 월 레이블로 식별한다. 각 체계가 낸 직접 시간축 수치만 사용하고 `synth.js`, `forecast.js`의 영역 합성 점수, Claude 해석을 쓰지 않는다.

## 구조

- `src/validation/benchmark.js`: 입력 검증, 사건별 기간 구성, `CORE_IDS` 기반 체계 선택, 월 점수 수집과 실패 격리.
- `src/validation/metrics.js`: 동점 평균순위, percentile, Hit@K, tolerance hit, 최근 최고점 오차, 무작위 기대 baseline과 집계.
- `src/validation/runner.js`: 사람·사건·체계 결과, 체계별 및 domain별 요약, JSON 직렬화용 결과를 만든다.
- `scripts/fortune-benchmark.mjs`: 파일 읽기, 콘솔 표와 선택 JSON 파일 출력, 비정상 입력의 명확한 종료 메시지.

현재 `hires/grid.js`는 핵심 네 체계 월 계산을 이미 한 곳에 모으므로 변경하지 않는다. benchmark 어댑터가 그 격자의 `bazi`, `ziwei`, `western`, `vedic` 결과를 각 체계의 기존 점수 함수로 전달한다. 도메인은 기존 산법이 직접 지원하지 않는 경우 체계 결과에 `unavailable`로 남기며, 임의의 새 domain 가중치는 만들지 않는다.

## 측정 규칙

점수는 체계 내부에서만 내림차순 비교한다. 실제 사건 월은 그 달의 점수로 평가하며, 동점은 같은 묶음의 평균 순위를 사용한다. percentile은 0~100에서 높을수록 좋고, `100 * (N - rank) / (N - 1)`이다. `N=1`일 때는 100으로 둔다.

`Hit@1`, `Hit@3`, `Hit@5`는 상위 K개 월 중 tolerance 범위에 있는 월이 하나라도 있는지로 계산한다. 동점 경계는 동일 점수의 모든 월을 포함해 임의 순서가 적중을 바꾸지 않도록 한다. `toleranceHit`은 최상위 점수 월들 중 하나가 허용 범위에 있는지다. `nearestPeakError`는 최상위 점수 월들 가운데 사건 월까지 월 거리의 최솟값이다.

랜덤 baseline은 비교구간의 균등 월 선택으로 계산한다. 따라서 Hit@K 기대값은 `min(K, N) / N`이며 tolerance hit 기대값은 허용 범위 안의 비교 달 수 / N이다. 체계의 Hit@K에는 baseline 대비 퍼센트포인트 차이를 함께 표시한다. `baserate.js`는 읽거나 합성하지 않는다.

전체 및 domain 집계는 사건-체계 결과 중 실제 점수가 있는 결과만 표본으로 쓴다. n, 평균/중앙 percentile, Hit@1/3/5, 평균 월 오차를 산출한다. domain 표는 n, 평균 percentile, Hit@3/5, 평균 월 오차와 `n < 10` 표본 부족 표시를 낸다.

## 오류와 재현성

출생시각이 없으면 `requiresTime` 체계는 `skipped`로 남기고 나머지 체계는 계속 평가한다. 한 체계 또는 한 달 계산 오류도 해당 결과의 오류 목록으로 격리하고 다른 체계·사건·사람을 멈추지 않는다. 사건 기간이 엔진 입력 범위 밖이거나 domain 점수를 만들 수 없으면 경고와 함께 집계에서 제외한다.

README에는 개별 실패 사례에 맞춘 규칙 추가 금지, 독립 사례에서 반복되는 실패 패턴만 수정 후보, 30~50건 전 가중치 자동 최적화 금지 원칙을 명시한다. 조합 실험은 결과 형식에서 `systemId` 확장으로 예약하지만 이번 구현에서는 4개 단일 체계만 평가한다.

## 검증

Node 내장 테스트로 최고점 Hit@1, ±2개월 tolerance, 동점 평균순위와 percentile, 데이터 부족 경고, 시각 미상 skip, 시스템 실패 격리를 고정한다. CLI는 sample 데이터를 대상으로 콘솔 및 JSON 출력까지 실행한다. 전체 기존 운세 테스트도 실행한다.
