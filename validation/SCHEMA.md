# 정답표 규격 (`validation/people.json`)

실제 사람 자료는 **저장소에 올리지 않습니다.** 이 파일과
`people.example.json`(지어낸 자료)만 남습니다.

```bash
node validation/build-people.mjs        # 기존 사례 파일 셋 → people.json
node scripts/validate-semantic.mjs      # 사람 단위 LOO
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
    "attributes": ["technical", "analytical", "organization"],
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
- `attributes` 는 `src/semantic/axes.js` 의 직업 축 이름입니다. 직업 하나에
  여러 개가 동시에 참입니다 — 개발자는 기술·분석·조직이 함께입니다.
- 직업 이름에서 이 값들을 뽑는 표가 `src/validation/occupations.js` 입니다.
  **명반은 그 파일을 보지 않습니다.** 고쳐도 예측은 안 바뀌고 채점 기준만 바뀝니다.

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

## 몇 명이 모이면 무엇을 할 수 있나

| 사람 | 할 수 있는 것 |
|---|---|
| ~11 (지금) | 구조가 도는지, 규칙이 정반대를 말하지 않는지 확인 |
| 30 | 업종 16칸에서 한계분포를 넘는지 **처음으로** 물어볼 수 있음 |
| 60 | 체계×분야 실측 무게를 조심스럽게 움직여도 됨 (shrinkage 유지) |
| 150+ | 축 정의 자체를 자료로 다듬고, 시기 층을 따로 검증 |

16칸짜리 분포에서 11명은 **칸당 0.7명**입니다. 지금 숫자로 무엇이
맞았다고 말할 수 없는 이유가 이것입니다.
