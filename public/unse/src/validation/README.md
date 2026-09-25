# 핵심 체계 백테스트

```bash
node scripts/fortune-benchmark.mjs validation-data/sample.json
node scripts/fortune-benchmark.mjs validation-data/cases.json --json benchmark-result.json
```

입력은 익명 `id`, 출생 정보가 든 `profile`, `domain`, `type`, `date: "YYYY-MM"`, 선택 `toleranceMonths`를 가진 `events` 배열이다. 이름은 저장하지 않는다.

각 핵심 체계는 비교 창의 직접 월 점수만으로 percentile, 동점 평균순위, Hit@1/3/5, 최고점 월 오차, tolerance hit을 계산한다. 점수는 확률이 아니라 그 체계 안의 시간 순위다. Hit@K에는 동일 창에서 균등하게 달을 고르는 random baseline을 함께 JSON으로 남긴다. domain 표본이 10 미만이면 `insufficientSample`이 참이다.

개별 실패 사례를 보고 그 사례에 맞는 규칙을 추가하지 않는다. 독립 사례에서 같은 실패 패턴이 반복될 때만 규칙 수정 후보로 본다. 사건 30~50건이 모이기 전에는 백테스트 데이터로 가중치를 자동 최적화하지 않는다.
