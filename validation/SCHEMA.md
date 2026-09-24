# 정답표 규격 (`validation/people.json`)

실제 사람 자료는 **저장소에 올리지 않습니다.** 이 파일과
`people.example.json`(지어낸 자료)만 남습니다.

```bash
node validation/build-people.mjs        # 기존 사례 파일 셋 → people.json
node scripts/analyze-career.mjs --loo   # 체계 × 속성 성능 + 사람 단위 LOO
```

---

## 한 사람

```json
{
  "id": "P01",
  "birth": { "gender": "female", "year": 1992, "month": 1, "day": 30,
             "hour": 16, "minute": 28, "birthPlace": "여주", "homePlace": "대전" },
  "labels": { "...": "아래" },
  "plannedFutureEvents": []
}
```

- `birth` 에 **이름·연락처·주소를 넣지 않습니다.** 넣으면
  `assertNoPersonalFields` 가 채점을 멈춥니다.
- `hour`·`minute` 를 **모르면 빼세요.** 지어내면 안 됩니다. 시각이 없으면
  자미두수와 점성 하우스가 `unavailable` 로 빠지고, 그건 오답이 아닙니다.

## 칸마다 상태를 붙입니다

| status | 뜻 | 채점 |
|---|---|---|
| `known` | 값을 안다 | 한다 |
| `unknown` | 안 물어봤거나 못 들었다 | **뺀다** |
| `not_applicable` | 그 사람에게 성립하지 않는다 | **뺀다** |
| `censored` | 아직 안 일어났을 뿐이다 | 절단으로 |

빈칸을 0 이나 '아니오'로 채우면 **모르는 것이 오답으로 세어집니다.**
그게 이 표가 넷으로 갈린 유일한 이유입니다.

## 칸

```json
"labels": {
  "career": {
    "status": "known",
    "category": "it_software",
    "occupationKey": "개발자",
    "employmentForm": "organization",
    "switching": "한우물"
  },
  "relationship": { "status": "known", "marriedAtAge": 31, "unionTiming": "mid" },
  "children":     { "status": "known", "count": 1, "band": "average" },
  "education":    { "status": "known", "path": "formal_continuous" },
  "residence":    { "status": "unknown" },
  "wealth":       { "status": "unknown" },
  "health":       { "status": "not_applicable" }
}
```

- `category` 값은 `src/semantic/categories.js` 의 `CAREER_CATEGORIES` 키입니다.
- `occupationKey` 는 `src/semantic/tables/occupations.js` 의 직업 이름입니다.
  정답 속성 벡터는 거기서 읽습니다 — 정답 정의를 한 군데에만 둡니다.
  **명반은 그 파일을 보지 않습니다.** 고쳐도 예측은 안 바뀌고 채점 기준만 바뀝니다.
- 직업 하나에 여러 속성이 동시에 참입니다 — 개발자는 기술·분석·정보·문제해결·
  전문성이 함께이고, 그래서 연구원으로 잘못 읽은 것과 미용사로 잘못 읽은 것이
  구별됩니다.

## 미혼을 '결혼 안 함'으로 적지 않습니다

34세 현재 미혼이면 관측된 것은 "34세까지 결혼 사건이 없었다"뿐입니다.

```json
"relationship": { "status": "censored", "observedUntilAge": 34 }
```

## 예정된 일은 정답이 아닙니다

"2027-10 결혼 예정"은 아직 일어나지 않았습니다. `plannedFutureEvents` 에
따로 두고 채점에 넣지 않습니다. 실제로 일어난 뒤 `known` 으로 올립니다.

```json
"plannedFutureEvents": [
  { "domain": "relationship", "date": "2027-10", "note": "아직 일어나지 않음" }
]
```

## 건강

`not_applicable` 로 둡니다. 이 엔진은 질환명·수술 여부를 예측하지 않고,
그런 칸을 채점 대상으로 삼으면 곧 그것을 맞히려 들게 됩니다.

---

## 표본

지금 열한 명입니다. 이 자료는 **해석 사전을 만들고 고치는 사례집**이지
예측력을 증명하는 자료가 아닙니다. 검증이 얇은 자리는 `provisional` 로
표시하고, 규칙은 `한 사람 때문에 고치지 않는다`는 원칙으로 다룹니다
(`src/semantic/README.md`).


---

## 시나리오 층을 채점하려면 (`scripts/validate-scenario.mjs`)

`{domain, year, month, what}` 만으로는 **시기와 국면까지만** 잴 수 있습니다.
사건 종류·방향·지역은 정답 라벨이 없으면 잴 수 없고, `what` 문장을 읽어
짐작해 채우면 그건 채점이 아니라 답을 베끼는 일입니다.

재고 싶으면 사건마다 아래를 적으세요. **모르면 비워 두세요.**

```json
{
  "domain": "직업",
  "year": 2021, "month": 10,
  "what": "다른 회사로 옮김",

  "eventType": "job_change",
  "direction": "job_change",
  "location": { "metro": "대전", "district": "유성구" }
}
```

- `eventType` 은 `src/semantic/timing/events.js` 의 `EVENT_CANDIDATES` 키입니다.
  직업이면 `first_job · job_change · role_change · promotion · resignation ·
  freelance · business_start · career_break · return_to_work` 중 하나입니다.
- 사람마다 `currentState` 를 적으면 상태 기계가 갈 수 없는 후보를 지웁니다.
  ```json
  { "id": "P01", "birth": {...}, "currentState": { "employmentType": "employed" } }
  ```
  적지 않으면 아무것도 지우지 않습니다 — 그게 맞습니다. 모르는 것을
  추측해 지우면 없는 근거로 후보를 깎게 됩니다.
- 라벨을 나중에 붙여도 됩니다. 붙은 사건만 그 지표에서 채점됩니다.
