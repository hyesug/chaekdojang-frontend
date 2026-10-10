<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 책도장 Web 작업 지침

Next.js·TypeScript·Tailwind 프론트엔드다. API 계약 변경은 백엔드와 호출부 영향을 함께 확인하며, 기존 JWT 처리 방식을 따른다.

## 작업 방식

- 불확실한 요구는 먼저 질문한다. 요청 밖 기능·리팩터링·파일 생성은 하지 않는다.
- 관련 파일부터 `rg`로 찾고 필요한 함수·구간만 읽는다. 전체 탐색·대용량 파일·전체 로그·같은 조사 반복을 피한다.
- 수정 범위를 최소화하고 기존 스타일을 따른다. 관련 테스트부터 실행하고 실패는 원인 중심으로 수정한다.
- 완료 보고는 변경 파일, 핵심 변경, 테스트, 남은 문제만 짧게 쓴다.

## AI API 비용

- AI 호출은 제거→중복 제거→입력/컨텍스트 축소→출력 제한→캐시/배치→저비용 모델 우선 순으로 검토한다. 정확성·보안·데이터 무결성·테스트 가능성을 희생하지 않는다.
- 매칭·정렬·필터링·계산·정규식·단순 규칙 분류는 일반 코드로 처리한다. 반복문 호출은 배치하고, 같은 입력 결과는 재사용한다.
- HTML/JSON/DB 결과/로그 전체 대신 필요한 필드·구간만 전달한다. 긴 입력은 검색·사전 필터링·기존 요약·chunk·token budget을 사용한다.
- 대화는 저장 요약 + 최근 메시지 + 현재 요청만 보낸다. 프롬프트는 중앙 관리하고 짧은 지시·출력 형식·최대 토큰을 명시한다.
- 가능하면 모델, input/output/total tokens, 호출 수, latency, estimated cost를 기록하고 실측 전후로 평가한다.

## 운세·반영

- `public/unse/` 변경 시에만 그 폴더의 `AGENTS.md`와 관련 테스트를 읽는다.
- 운세 AI 호출은 기존 `app/fortune-ai/route.ts`의 Claude 경로만 사용한다. 다른 제공자·fallback·의존성 추가는 명시 승인 없이는 하지 않는다. 상세 판단 근거는 필요할 때만 `docs/fortune-and-frontend-notes.md`를 참고한다.
- 커밋은 `type(scope): 한국어 설명`을 쓴다. push·스테이징·운영 배포·`main` 반영은 사용자의 명시 요청이 있을 때만 한다.
