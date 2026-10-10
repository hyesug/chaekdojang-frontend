# 책도장 청록 잉크 아카이브 디자인 시스템

## 목표

책도장의 독서 기록, 사람, 도장 경험과 운세 정적 화면을 하나의 성숙한 편집 디자인 언어로 통합한다. 결과물은 청록 잉크와 종이 표면을 중심으로 한 디지털 아카이브이며, 운세도 별도 점술 서비스처럼 보이지 않고 기록 서비스의 한 경험으로 인식되어야 한다.

이 작업은 URL, API 요청과 응답, 데이터 모델, 인증 흐름, 사용자 기능을 변경하지 않는다. 새 UI 프레임워크나 외부 디자인 의존성도 추가하지 않는다.

## 사용자와 성공 기준

- 독서 기록을 읽고 쓰는 사용자는 긴 본문과 메타데이터를 편안하게 구분해 읽을 수 있다.
- 모바일 사용자는 360px부터 조작 가능한 크기의 컨트롤과 잘리지 않는 레이아웃을 사용한다.
- 운영자는 넓은 테이블을 읽을 수 있고, 좁은 화면에서 해당 테이블을 의도적으로 가로 스크롤할 수 있다.
- 운세 사용자는 동일한 브랜드의 문서·기록 경험 안에서 결과와 질문을 읽는다.
- 색상, radius, spacing, typography, focus, 상태 UI가 페이지마다 달라 보이지 않는다.

## 시각 언어

### 팔레트

| 역할 | 토큰 | 값 |
| --- | --- | --- |
| canvas | `--color-bg` | `#F3F2EB` |
| paper surface | `--color-surface` | `#FCFBF7` |
| primary ink | `--color-primary` | `#174A46` |
| deep ink | `--color-ink` | `#102A2C` |
| body text | `--color-text` | `#182321` |
| muted ink | `--color-text-muted` | `#56706A` |
| sage support | `--color-sage` | `#78988F` |
| stamp accent | `--color-accent` | `#8B3040` |
| border | `--color-border` | `#C9D1C8` |
| danger | `--color-danger` | accessible deep red derived from the wine family |
| success | `--color-success` | accessible deep jade derived from the primary family |

Primary and its tints are the dominant chromatic language. Surface paper and ivory establish the reading field. Wine is reserved for a record/stamp mark, selected completion state, and rare high-importance emphasis; it is never the default CTA color.

### Geometry and hierarchy

- `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`, `--radius-full: 999px`.
- Use no shadow by default. A single subtle elevated token is only for modal/dialog surfaces and floating menus.
- Sections are separated by vertical rhythm, thin rules, headings, and responsive columns. A page-level white card must have a content or interaction reason.
- Pills are restricted to compact tags, filters, status labels, and avatars. Buttons are rectangular with restrained corners.
- Gradients are removed unless they explain a data visualization. Decorative gradients are not used.

### Typography

- The existing locally available Korean sans stack remains the default body face.
- The existing serif stack is limited to display headings, book titles where appropriate, and quotation/record accents.
- Establish shared display, H1, H2, H3, body, label, meta, and caption tokens with stable line-heights.
- Metrics use tabular figures where available, especially in dashboards and tables.

## System architecture

### Token layer

`app/globals.css` becomes the source of truth for CSS custom properties and Tailwind v4 semantic theme aliases. It also owns base element styling, focus-visible, selection, and reusable utility classes that are not component-specific.

Hard-coded page colors migrate to semantic tokens or Tailwind semantic aliases. Third-party/service identity colors, book-cover imagery, and data visualization colors remain local only where semantically required.

### Primitive layer

Small React primitives encapsulate repeated visual and accessibility behavior without altering data flow:

- buttons: primary, secondary, danger, text/link;
- fields: label, description, error association, input, select, textarea, checkbox, radio;
- content: section heading, paper surface, tag/status badge, alert, empty state, loading/skeleton;
- navigation/data: tabs, pagination, table wrapper;
- overlays: modal shell and confirmation pattern.

Existing handlers, fetch calls, links, state management, and server components remain in their current files. Primitives accept native control props and semantic class variants rather than duplicate request logic.

### Shell layer

The root layout, header, footer, authentication controls, administrative link, and mobile menu use the same tokens. Navigation keeps the existing information architecture; the redesign clarifies reading-service destinations, utility actions, and account/administrator actions through placement and text hierarchy only.

### Fortune integration

The vanilla ES-module app in `public/unse/` remains vanilla. Its stylesheet receives the same palette, type stack, radius scale, controls, rules, and responsive treatment without converting it to React or altering its calculation/AI paths. Required instructions in `public/unse/AGENTS.md` govern those edits.

## Application scope

1. Global shell, form/control/state primitives, 404/error/loading fallbacks.
2. Feed, explore, search, library, book detail, reviews, write/edit, bookmarks, chat.
3. Authentication, onboarding, profiles, reading log/goal/calendar/stats, notifications.
4. Groups, contests, dojangdan, CS, subscription/payment/legal/install.
5. Admin dashboard, user and inquiry detail, fortune operations: dense data tables and confirmation/error treatments.
6. Fortune static entry, results, questions, and sharing UI.

## Responsive rules

- Design from 360px upward; no horizontal overflow except intentional table wrappers.
- Use a compact navigation treatment below the existing desktop threshold.
- One-column reading and form flows are default on mobile; two or more columns are introduced only when content can retain readable measure.
- Modals use max-height and internal scrolling; footer and CTA rows can wrap without clipped controls.
- Verify representative screens at approximately 360px, 768px, 1024px, and 1440px.

## Accessibility rules

- All keyboard-focusable items show a high-contrast `:focus-visible` outline.
- Text and controls target WCAG AA contrast; state meaning is paired with text/icon and not color alone.
- Inputs have programmatic labels; descriptions and errors use `aria-describedby`/`aria-invalid` as applicable.
- Interactive controls have a 44px minimum target where layout allows; compact data-table controls retain visible focus and accessible labels.
- Loading, error, empty, confirmation, and dialog states use appropriate roles and announcements.

## Verification

- Run lint and production build after the system migration.
- Run existing fortune tests before and after edits to `public/unse/` and build its bundle through the existing build script.
- Run targeted tests if component tests exist; preserve behavior through type checking and build validation.
- Perform manual visual QA on the representative desktop/mobile routes listed above, including navigation, long text, forms, modal overflow, tables, empty/error/loading states, and keyboard focus.

## Exclusions

- No API contract, backend, authentication, routing, URL, database, or business-rule change.
- No Tailwind/Bootstrap/framework replacement.
- No generated decorative imagery or generic purple/blue “fortune” visual language.
- No indiscriminate conversion of all content into white cards.
