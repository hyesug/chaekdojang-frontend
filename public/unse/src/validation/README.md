# 핵심 체계 백테스트

```bash
node scripts/fortune-benchmark.mjs validation-data/sample.json
node scripts/fortune-benchmark.mjs validation-data/cases.json --json benchmark-result.json
```

입력은 익명 `id`, 출생 정보가 든 `profile`, `domain`, `type`, `date: "YYYY-MM"`, 선택 `toleranceMonths`를 가진 `events` 배열이다. 이름은 저장하지 않는다.

각 핵심 체계는 비교 창의 직접 월 점수만으로 percentile, 동점 평균순위, Hit@1/3/5, 최고점 월 오차, tolerance hit을 계산한다. 점수는 확률이 아니라 그 체계 안의 시간 순위다. Hit@K에는 동일 창에서 균등하게 달을 고르는 random baseline을 함께 JSON으로 남긴다. domain 표본이 10 미만이면 `insufficientSample`이 참이다.

개별 실패 사례를 보고 그 사례에 맞는 규칙을 추가하지 않는다. 독립 사례에서 같은 실패 패턴이 반복될 때만 규칙 수정 후보로 본다. 사건 30~50건이 모이기 전에는 백테스트 데이터로 가중치를 자동 최적화하지 않는다.

## 분야별 체계 선택 원칙

학습기는 모든 17개 체계의 단독 후보와 서로 다른 계보의 사전등록 조합을 같은 사건으로 비교한다. 분야마다 결과는 다음 셋 중 하나로 남긴다.

- `service`: 사람 단위 LOO·날짜 섞기 검증까지 통과한 선택
- `provisional`: 사례가 부족해 LOO 투표 또는 단일 사례에 맞춘 잠정 선택
- `prior`: 해당 분야의 구체 사건 사례가 전혀 없어, 전용 시기 자리가 있는 체계를 동점 조합한 사전 후보

LOO 표 수와 전체 점수까지 동점이면 임의의 타이브레이크를 하지 않고 후보 체계를 조합한다. 사례 한 건뿐이면 그 사건에 가장 잘 맞는 체계를 잠정 선택한다. `provisional`과 `prior`는 화면에 각각의 근거 등급을 붙여 보이며, 서비스 검증을 통과했다는 뜻은 아니다.
