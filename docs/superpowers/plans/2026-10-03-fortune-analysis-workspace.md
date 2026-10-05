# 운세 분석 워크스페이스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/unse/`와 기존 질문권 구매 화면을 청록 잉크 아카이브 기반의 집중형 명반 분석 경험으로 재구성한다.

**Architecture:** 정적 운세 앱의 입력·결과·AI 렌더러를 역할별 CSS와 작은 화면 상태 함수로 정비한다. 계산·AI 컨텍스트·결제 API는 기존 경계를 유지하고, 질문권 조회는 기존 API를 읽기 전용으로 사용한다. `/ai-credits`는 같은 시각 토큰으로만 개편한다.

**Tech Stack:** Vanilla ES modules, static HTML/CSS, esbuild bundle script, Next.js 16, React 19, TypeScript, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-10-03-fortune-analysis-workspace-design.md`

## Global Constraints

- `engine.js`, `compat.js`, `forecast.js`, 계산 기대값, AI context 내용과 `/fortune-ai` 요청 계약을 변경하지 않는다.
- 새 UI 라이브러리·웹폰트·이미지·장식 애니메이션을 추가하지 않는다.
- `public/unse/app.js`와 chunk는 `npm run unse:bundle`로만 갱신한다.
- 질문권 잔액과 paywall은 기존 API 응답으로만 판단하며 클라이언트가 환경 설정을 추정하지 않는다.
- 버튼·입력·상태는 키보드와 360px 화면에서도 작동해야 한다.

## Review Focus

- 시각 미상·음력·궁합의 두 번째 사람 입력이 새 폼 구조에서도 기존 수집 ID와 동일하게 계산되는지 `npm run test:unse`로 확인한다.
- 비로그인/네트워크 실패 시 잔액 미확인 상태가 "0회"로 잘못 보이지 않는지 화면 단위 테스트로 고정한다.
- AI 스트리밍 도중 오류가 나도 누적 답변·입력 질문·재시도 버튼이 남는지 기존 AI 테스트와 UI 동작으로 확인한다.
- 15개 체계 상세를 접어도 URL 복원, AI 초기화, 보고서 내용이 누락되지 않는지 렌더 결과로 확인한다.
- 결제 SDK가 아직 로드되지 않았거나 판매 준비 중일 때 결제 버튼의 disable/상태 문구가 정확한지 TypeScript 빌드와 화면 QA로 확인한다.

---

### Task 1: 입력 워크스페이스와 접근 가능한 계산 상태

**Files:**
- Modify: `public/unse/index.html:82-191`
- Modify: `public/unse/src/boot.js:67-177`
- Modify: `public/unse/assets/style.css:1-385`
- Test: `tests/unse/viewmodel.test.mjs`

**Interfaces:**
- Consumes: 기존 필드 ID (`name`, `gender`, `calendar`, `year`, `month`, `day`, `hour`, `minute`, `noTime`, `birthPlace`, `homePlace`, `dst`)와 `ui.run(mode, box, next)`.
- Produces: 동일 필드 ID를 보존한 semantic form, `setFormError(message, fieldId?)`, `setCalculationState(state)` 화면 동작.

- [ ] **Step 1: 입력 ID와 진행 상태에 의존하는 기존 운세 테스트 실행**

Run: `npm run test:unse`

Expected: 기존 엔진·viewmodel 테스트가 통과하며 UI 변경 전 기준을 확보한다.

- [ ] **Step 2: 입력 폼의 의미론과 안내 구조를 변경**

`index.html`에서 기본 입력, 보정 옵션, 개인정보 안내를 fieldset/legend·도움말 ID로 재배치한다. 기존 모든 input ID와 `personA`/`personB` 복제 구조는 유지하고, 모드 버튼에 선택 상태 속성을 추가한다.

- [ ] **Step 3: `boot.js`에 검증 오류와 계산 상태 화면을 구현**

오류 시 첫 관련 필드를 포커스하고 오류 ID를 `aria-describedby`로 연결한다. 계산 진행 상자에 `role=status`, `aria-live`, `aria-busy`를 적용하고 제출 중복을 방지하며 성공·실패 시 상태를 원복한다.

- [ ] **Step 4: 운세 입력/진행 CSS를 편집형 시스템으로 교체**

공통 팔레트 토큰과 4~6px 반경을 사용한다. 큰 hero·반복 카드·캡슐 탭을 줄이고, 360px에서 날짜·시간·장소 입력과 CTA가 잘리지 않도록 grid를 조정한다.

- [ ] **Step 5: 운세 테스트와 정적 bundle 검증**

Run: `npm run test:unse && npm run unse:bundle`

Expected: PASS, 산출물은 source 변경과 일치한다.

- [ ] **Step 6: Commit**

```bash
git add public/unse/index.html public/unse/src/boot.js public/unse/assets/style.css public/unse/app.js public/unse/app-*.js
git commit -m "feat(unse): 입력 분석 흐름과 상태 정비"
```

### Task 2: 결과 위계와 15개 체계의 점진 공개

**Files:**
- Modify: `public/unse/src/ui.js:134-435`
- Modify: `public/unse/src/report.js:460-617`
- Modify: `public/unse/assets/style.css:130-1048`
- Test: `tests/unse/viewmodel.test.mjs`

**Interfaces:**
- Consumes: `buildView`, `buildCompatView`, `renderReport`, `renderPairReport`, `initAI`, `initCompatAI`의 현재 입력·출력.
- Produces: `render(form, r, f)`와 `renderCompat(formA, formB, r)`가 `계산값`·`해석` 라벨, 결과 머리말, 접힌 세부 보고서를 렌더한다.

- [ ] **Step 1: 개인·궁합 결과 fixture의 기존 테스트를 실행**

Run: `node --test tests/unse/viewmodel.test.mjs`

Expected: PASS.

- [ ] **Step 2: `ui.js`의 결과 머리말과 핵심 결과 순서를 재구성**

개인/궁합 모두 분석 대상·입력 기준을 담은 기록 머리말을 먼저 렌더한다. 핵심 종합 해석, 명반 요약, AI, 세부 보고서 순서로 바꾸되 기존 `last`, URL 공유, 프로필 저장, AI 초기화 호출을 보존한다.

- [ ] **Step 3: `report.js`의 긴 보고서를 기본 접힘 세부 계산으로 전환**

기존 보고서 문장·표를 바꾸지 않고 `details` 요약에 체계 범위와 해석/계산 구분을 추가한다. 기본 `open`을 제거해 첫 결과의 정보 밀도를 낮춘다.

- [ ] **Step 4: 명반·탭·표·details의 시각 규칙을 정리**

계산값은 작은 역할 라벨과 표 중심으로, 해석은 읽기 좋은 문단 폭으로 표현한다. 0~100처럼 보이는 값을 정확도로 표현하지 않고, 모바일 표는 필요한 경우에만 안전하게 수평 스크롤한다.

- [ ] **Step 5: 회귀와 bundle 확인**

Run: `npm run test:unse && npm run unse:bundle`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/unse/src/ui.js public/unse/src/report.js public/unse/assets/style.css public/unse/app.js public/unse/app-*.js
git commit -m "feat(unse): 명반 결과 위계와 상세 보기 개편"
```

### Task 3: AI 상담 기록, 질문권 상태, paywall 화면

**Files:**
- Create: `public/unse/src/credits.js`
- Modify: `public/unse/src/ai.js:147-390`
- Modify: `public/unse/src/ui.js:134-435`
- Modify: `public/unse/assets/style.css:487-566`
- Test: `tests/unse/context.test.mjs`

**Interfaces:**
- Consumes: `GET /api/fortune-ai/credits/me`, `loginUrl()`, existing `/fortune-ai` NDJSON response and existing `initAI`/`initCompatAI` calls.
- Produces: `loadCreditStatus(): Promise<{kind: 'available'|'exhausted'|'logged-out'|'unavailable', totalBalance?: number}>`; AI panel status rendering without changing POST request bodies.

- [ ] **Step 1: 기존 AI context 및 질문 라우팅 테스트 실행**

Run: `node --test tests/unse/context.test.mjs tests/unse/question-routing.test.mjs`

Expected: PASS.

- [ ] **Step 2: 읽기 전용 질문권 상태 모듈과 실패 구분을 구현**

`credits.js`는 기존 잔액 API의 성공·401/403·0잔액·네트워크/비정상 응답을 구분한다. POST, 결제 생성, 환경 변수 읽기, 잔액 추정은 하지 않는다.

- [ ] **Step 3: `aiSection`과 `wire`를 상담 기록 UI로 변경**

분석 대상, 보이는 textarea label, 잔액 상태, 빠른 질문, 로딩 기록 행을 렌더한다. 전송 실패는 응답 메시지 기반으로 로그인/잔액 부족/일반 AI 오류를 구분하고, 질문과 부분 답변·재시도는 보존한다.

- [ ] **Step 4: 질문권 소진 paywall과 AI 상태 CSS를 구현**

구매 의도가 발생한 경우에만 와인색 paywall 행을 표시한다. `/ai-credits`, `/payment-info`, `/terms` 링크는 사용하되 과장 문구를 쓰지 않는다. 긴 답변·360px textarea/전송 버튼·키보드 탐색을 검토한다.

- [ ] **Step 5: AI 회귀 및 bundle 검증**

Run: `npm run test:unse && npm run unse:bundle`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/unse/src/credits.js public/unse/src/ai.js public/unse/src/ui.js public/unse/assets/style.css public/unse/app.js public/unse/app-*.js
git commit -m "feat(unse): AI 질문권과 상담 기록 상태 추가"
```

### Task 4: 질문권 구매 화면의 동일 디자인 언어 적용

**Files:**
- Modify: `app/ai-credits/page.tsx:1-88`
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: `authFetch`, `PortOne.requestPayment`, 기존 product/balance/history API 응답 타입.
- Produces: 동일 API 호출·결제 순서를 보존한 접근 가능한 잔액·상품·결제 상태 화면.

- [ ] **Step 1: 현재 TypeScript 검증 실행**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 2: 구매 페이지의 구조와 스타일 역할을 정리**

카드 반복과 큰 반경을 줄이고, 잔액을 편집형 수치 표로, 상품을 비교 가능한 목록으로, 구매/대기/성공/실패를 명확한 상태 행으로 표현한다. 판매 준비 중 정책과 PortOne 호출·redirect URL은 유지한다.

- [ ] **Step 3: 결제 상태의 접근성 연결을 구현**

메시지에 `role=status` 또는 `role=alert`를 상태에 맞게 적용하고, busy 버튼의 의미와 중복 전송 방지를 유지한다. 환불·이용조건·개인정보 링크를 각 구매 단위와 연결한다.

- [ ] **Step 4: 타입 및 프로덕션 빌드 검증**

Run: `npx tsc --noEmit && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/ai-credits/page.tsx
git commit -m "feat(credits): 질문권 구매 화면 아카이브화"
```

### Task 5: 시각 QA와 최종 회귀

**Files:**
- Modify: `public/unse/assets/style.css` (only for confirmed QA fixes)
- Modify: relevant source files (only for confirmed QA fixes)
- Test: `tests/design-system.test.mjs`, `tests/unse/*.test.mjs`

**Interfaces:**
- Consumes: completed static bundle and Next app.
- Produces: desktop/tablet/mobile visual evidence and no known functional regression.

- [ ] **Step 1: 개발 서버 실행 후 개인·궁합 화면 확인**

Run: `npm run dev`

Expected: `/unse/`에서 개인/궁합 입력·결과·세부 계산·AI 영역이 로드된다.

- [ ] **Step 2: 360~390px, 768px, 1280px 이상에서 캡처 QA**

입력, 시간 미상, 궁합 두 번째 사람, 긴 AI 답변, 상세 체계, AI 입력, 질문권 구매 화면의 가로 스크롤·가림·버튼 최소 터치 영역을 확인한다.

- [ ] **Step 3: 접근성 상태를 키보드로 확인**

모드 선택, focus-visible, details, 오류 포커스, 계산·AI live region, 버튼 disabled 상태를 확인한다.

- [ ] **Step 4: 전체 검증 실행**

Run: `npm run test:design && npm run test:unse && npx tsc --noEmit && npm run build`

Expected: PASS; lint가 필요하면 기존 baseline과 새 위반을 분리해 기록한다.

- [ ] **Step 5: QA 보정과 최종 Commit**

```bash
git add public/unse/assets/style.css public/unse/src app/ai-credits/page.tsx public/unse/app.js public/unse/app-*.js
git commit -m "fix(unse): 반응형과 접근성 보완"
```
