# 책도장 청록 잉크 아카이브 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API·URL·데이터 동작을 바꾸지 않고, 책도장 전체와 운세 정적 화면을 청록 잉크 아카이브 디자인 시스템으로 통합한다.

**Architecture:** `globals.css`의 CSS 변수와 Tailwind v4 semantic theme aliases가 전역 foundation이 된다. 작은 접근성 중심 UI primitive는 기존 요청/상태 로직을 건드리지 않고 화면 컴포넌트에서 사용하며, 기존 Tailwind 색상 유틸리티는 semantic palette로 매핑해 미수정 페이지에도 일관된 기본 언어를 적용한다. 운세는 vanilla ES modules 구조를 유지하고 stylesheet와 markup class만 같은 토큰·형태 언어로 정렬한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, vanilla ES modules, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-01-chaekdojang-ink-archive-design.md`

## Global Constraints

- API contract, backend, authentication, routing, URL, database, business rules, and existing JWT handling must not change.
- Do not add a UI framework, a dependency, generated decorative imagery, or a purple/blue fortune visual language.
- Use Deep Jade Teal `#174A46`, Deep Ink `#102A2C`, Sage `#78988F`, Ivory `#F3F2EB`, Paper `#FCFBF7`, Wine `#8B3040`, and Main Text `#182321` through semantic tokens.
- Default geometry is 4px/6px/8px; `rounded-full` remains only for avatars and meaningful compact tags.
- Prefer rules, spacing, typographic hierarchy, and borders over nested cards and default shadows.
- Keep `public/unse/` vanilla; read and follow `public/unse/AGENTS.md` before editing it.
- Verify 360px, 768px, 1024px, and 1440px representative routes, keyboard focus, error/empty/loading behavior, table overflow, and modal overflow.
- Use Korean commit messages in `type(scope): 설명` format. Push only after all checks pass.

## Review Focus

- Small 360px header/account controls must wrap or collapse without clipping; Task 3 screenshot check owns this.
- Forms with server errors must expose a visible associated message without relying on red alone; Task 4 component/static test owns this.
- Dense administrator tables must keep a deliberate scroll container instead of forcing page-wide overflow; Task 7 visual check owns this.
- Unauthenticated and empty feed/profile/list states must retain clear next actions and no decorative empty icon dependency; Task 5 review owns this.
- Fortune output controls must preserve reduced-motion and print behavior while removing decorative gradients; Task 8 regression tests own this.

## File Structure

- `app/globals.css`: token source, Tailwind aliases, base typography, focus, legacy utility bridge, shared surface/control classes.
- `app/layout.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/loading.tsx`: global document shell and fallback states.
- `app/components/ui/*`: presentational primitives with no API or storage dependencies.
- `app/components/Header.tsx`, `MobileMenu.tsx`, `AuthButtons.tsx`, `AdminNavLink.tsx`: information hierarchy and responsive shell.
- `app/components/{ReviewCard,ReviewEditForm,ReviewDetailModal,FollowListModal}.tsx`: highest-frequency record components migrated to primitives.
- `app/{FeedClient,library,search,write,reviews,books,profile,u,calendar,reading-log,reading-goal,stats,notifications}/**`: reader journey pages using tokens and shared primitives.
- `app/{groups,contests,dojangdan,cs,auth,onboarding,subscription,ai-credits,payment-info,privacy,terms,install}/**`: form/list workflows using the same controls and sections.
- `app/admin/**`: dense administrative UI using table, tabs, filters, alerts, and confirmation styling.
- `public/unse/{assets/style.css,index.html,src/ui.js}`: vanilla fortune presentation only.
- `tests/design-system.test.mjs`: static regression checks for source-of-truth tokens, focus states, global fallbacks, and fortune stylesheet constraints.

### Task 1: Establish visual-regression guardrails and baseline

**Files:**
- Create: `tests/design-system.test.mjs`
- Modify: `package.json`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: project source paths and Node’s built-in test runner.
- Produces: `npm run test:design` and static assertions relied on by later tasks.

- [ ] **Step 1: Write failing `tests/design-system.test.mjs` assertions**

Assert that `app/globals.css` defines the seven exact brand color tokens, radius sm/md/lg tokens, a visible `:focus-visible` rule, and semantic aliases; assert `public/unse/assets/style.css` has no `linear-gradient`; assert root fallback files exist.

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test tests/design-system.test.mjs`

Expected: FAIL because the current files lack the jade/archive tokens, fallback files, and gradient removal.

- [ ] **Step 3: Add a `test:design` package script**

Use exactly `node --test tests/design-system.test.mjs`; do not change the existing `test` or fortune test commands.

- [ ] **Step 4: Run the static guard test and existing fortune baseline**

Run: `npm run test:design; npm run test:unse`

Expected: design test remains failing until Tasks 2 and 8; fortune suite passes unchanged.

### Task 2: Implement the global token foundation and fallback states

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `app/not-found.tsx`
- Create: `app/error.tsx`
- Create: `app/loading.tsx`
- Modify: `tests/design-system.test.mjs`

**Interfaces:**
- Consumes: exact token names in Task 1 and Next App Router fallback conventions.
- Produces: CSS custom properties and reusable classes (`cdj-page`, `cdj-section`, `cdj-surface`, `cdj-field`, `cdj-alert`, `cdj-skeleton`) for Tasks 3–8.

- [ ] **Step 1: Implement global semantic tokens and Tailwind aliases**

Define exact `--color-bg`, `--color-surface`, `--color-primary`, `--color-ink`, `--color-text`, `--color-text-muted`, `--color-sage`, `--color-accent`, and `--color-border` values from the spec. Define the 4/6/8px radius scale, 8px-based spacing values, type/line-height values, focus ring, and a single modal elevation. Map existing cream/brown classes to the new semantic palette so legacy pages inherit the system before their local migration.

- [ ] **Step 2: Replace global card-specific overrides with composable rules**

Remove the brittle `.stamp-card > ...` DOM-position selectors. Implement paper, rule, field, button, state, tab, table wrapper, and skeleton classes that do not use default shadows or decorative gradients.

- [ ] **Step 3: Apply shell and fallback components**

Update `app/layout.tsx` theme color/body/footer semantics; create Korean 404, error recovery, and loading fallbacks. Each fallback uses the shared page/section system, semantic heading order, and a clear action where appropriate.

- [ ] **Step 4: Run global static tests and lint**

Run: `npm run test:design; npm run lint`

Expected: PASS, including fallback existence and exact token/focus assertions.

- [ ] **Step 5: Commit foundation work**

Run: `git add app/globals.css app/layout.tsx app/not-found.tsx app/error.tsx app/loading.tsx tests/design-system.test.mjs package.json && git commit -m "feat(design): 청록 잉크 디자인 토큰 구축"`

### Task 3: Build accessibility-first primitives and redesign the application shell

**Files:**
- Create: `app/components/ui/{Button,Field,StatusBadge,Alert,EmptyState,LoadingState,SectionHeading,TableShell,Pagination,ModalShell}.tsx`
- Modify: `app/components/Header.tsx`
- Modify: `app/components/MobileMenu.tsx`
- Modify: `app/components/AuthButtons.tsx`
- Modify: `app/components/AdminNavLink.tsx`
- Modify: `app/components/{ReviewDetailModal,FollowListModal}.tsx`

**Interfaces:**
- Produces: `Button`, `Field`, `StatusBadge`, `Alert`, `EmptyState`, `LoadingState`, `SectionHeading`, `TableShell`, `Pagination`, and `ModalShell` presentational interfaces with native control props.
- Consumes: Task 2 `cdj-*` classes and tokens; no fetch/API interfaces may be added.

- [ ] **Step 1: Add a failing static assertion for semantic control affordances**

Extend `tests/design-system.test.mjs` to require `aria-invalid`, `aria-describedby`, or explicit label support in `Field`, and `role="dialog"`, `aria-modal="true"`, Escape/focus behavior in `ModalShell`.

- [ ] **Step 2: Implement the primitives with native HTML props**

Use variants `primary|secondary|danger|text` for `Button`; represent a field label, hint, and error with stable generated IDs; render status text alongside any color treatment. Keep native `button`, `input`, `select`, and `textarea` behavior intact.

- [ ] **Step 3: Refactor shell and existing modals to primitives**

Keep all current links/menu destinations. Give the header a paper-like rule, calm wordmark/stamp mark, active/utility hierarchy, and mobile navigation that preserves a 44px target. Replace modal shell styling without changing their data/state callbacks.

- [ ] **Step 4: Verify at desktop and 360px**

Run: `npm run lint; npm run build`

Then inspect `/`, `/auth/login`, and a modal-producing route at 360px and 1440px; tab through header and modal controls. Expected: no clipped header controls, visible focus, and modal content scrolls internally.

- [ ] **Step 5: Commit shell/primitives work**

Run: `git add app/components && git commit -m "feat(ui): 공통 편집형 UI 컴포넌트 적용"`

### Task 4: Migrate account, form, and service workflows

**Files:**
- Modify: `app/auth/{login,register,forgot-password}/page.tsx`
- Modify: `app/{onboarding,setup-nickname,profile,subscription,ai-credits,payment-info,privacy,terms,install}/page.tsx`
- Modify: `app/cs/{page.tsx,[id]/page.tsx}`
- Modify: `app/components/{ReviewEditForm,ProfileAvatar,PwaInstallCta,IosInstallBanner}.tsx`

**Interfaces:**
- Consumes: `Button`, `Field`, `Alert`, `SectionHeading`, `LoadingState` from Task 3.
- Produces: form pages with associated labels/errors and no duplicate local control language.

- [ ] **Step 1: Identify one representative local form error in each family and add source assertions**

Extend the design static test to check the auth and CS form pages contain labels associated with their input controls and retain error text on failed requests.

- [ ] **Step 2: Replace repeated form/card classes with shared primitives**

Preserve each existing submit handler, disabled/loading condition, redirect, API call, and validation text. Use paper sections/rules rather than nested rounded white containers; reserve wine only for record/important status treatment.

- [ ] **Step 3: Check form keyboard and error behavior**

Run: `npm run test:design; npm run lint`

Manually verify login, registration, profile, CS, and review edit invalid/error/loading states at 360px. Expected: label click focus, visible error linkage, and no color-only state.

- [ ] **Step 4: Commit workflow migration**

Run: `git add app/auth app/onboarding app/setup-nickname app/profile app/subscription app/ai-credits app/payment-info app/privacy app/terms app/install app/cs app/components && git commit -m "feat(ui): 계정과 입력 화면 통일"`

### Task 5: Migrate the core reader journey

**Files:**
- Modify: `app/{FeedClient,explore/page,library/page,search/page,bookmarks/page,notifications/page,calendar/page,reading-log/page,reading-goal/page,stats/page,write/page}.tsx`
- Modify: `app/books/[id]/{page,BookDetailClient,reaction-report/page,reviews/page}.tsx`
- Modify: `app/reviews/[id]/{page,edit/page}.tsx`
- Modify: `app/u/[nickname]/{page,library/page,PublicProfileReviews,PublicProfileFollowButton}.tsx`
- Modify: `app/components/{ReviewCard,ReviewEngagement,ReviewOwnerActions,ReviewReflectionPanel,ReviewRereadHistory,ReviewContinuations,ReadingGoalProgress,PublicProfileStats,AiReadingCard}.tsx`

**Interfaces:**
- Consumes: Task 3 content primitives and Task 2 global layout/tokens.
- Produces: reading pages with consistent record metadata, content measure, tags, actions, and empty/loading states.

- [ ] **Step 1: Write source assertions for key empty states and core surface hierarchy**

Require the feed’s unauthenticated/empty copy, library empty state, and review metadata remain in source; assert `ReviewCard` no longer depends on the removed structural `.stamp-card` selector.

- [ ] **Step 2: Convert reader surfaces to document-layout hierarchy**

Keep all fetch/state/link behavior. Use a page heading, supporting metadata line, dividers, limited paper panels, rectangular controls, narrow content measure for long reviews, and genuine tags only where filtering/status requires them. Remove core decorative gradients and default card shadows.

- [ ] **Step 3: Verify reader routes**

Run: `npm run test:design; npm run lint; npm run build`

Inspect `/`, `/search?tab=books`, `/library`, `/books/[known-id]`, `/reviews/[known-id]`, `/write`, `/profile`, and `/stats` at 360px/768px/1440px. Expected: readable hierarchy, no clipped actions, no unintentional horizontal scroll.

- [ ] **Step 4: Commit reader migration**

Run: `git add app/FeedClient.tsx app/explore app/library app/search app/bookmarks app/notifications app/calendar app/reading-log app/reading-goal app/stats app/write app/books app/reviews app/u app/components && git commit -m "feat(ui): 독서 기록 경험 재정비"`

### Task 6: Migrate community, campaign, and campaign-management workflows

**Files:**
- Modify: `app/groups/**`
- Modify: `app/contests/**`
- Modify: `app/dojangdan/**`
- Modify: `app/demo/dojangdan/page.tsx`

**Interfaces:**
- Consumes: Task 3 Button/Field/StatusBadge/Alert/EmptyState/Pagination/TableShell.
- Produces: consistent campaign/group status, filters, forms, tables, empty states, and confirmation treatment.

- [ ] **Step 1: Add a static test for restricted pill usage and campaign status text**

Assert status remains textual, maps existing campaign statuses, and no generic action button uses `rounded-full` in this feature family.

- [ ] **Step 2: Replace nested card/form patterns**

Keep campaign states, invitations, upload, exports, application decisions, and all requests intact. Use section rules and dense paper panels for lists; use wine only for a selected/completed stamp state rather than generic CTA.

- [ ] **Step 3: Verify campaign and group workflows**

Run: `npm run test:design; npm run lint`

Inspect group list/detail/new, contest list/entry, dojangdan list/application/my/manage at mobile and desktop widths. Expected: filters wrap, tables contain overflow, and action hierarchy is clear.

- [ ] **Step 4: Commit community migration**

Run: `git add app/groups app/contests app/dojangdan app/demo/dojangdan tests/design-system.test.mjs && git commit -m "feat(ui): 모임과 도장단 화면 통일"`

### Task 7: Migrate administrator and dense-data interfaces

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/fortune-operations/page.tsx`
- Modify: `app/admin/inquiries/[id]/page.tsx`
- Modify: `app/admin/users/[userId]/page.tsx`

**Interfaces:**
- Consumes: Task 3 tabs, table shell, form, alert, empty/loading, modal/confirmation primitives.
- Produces: stable dense tables and filters that preserve all existing administrator actions.

- [ ] **Step 1: Add a static test for explicit table overflow and non-color-only status text**

Assert the administration table wrapper keeps `overflow-x-auto`/accessible table semantics and page controls retain textual status markers.

- [ ] **Step 2: Migrate admin tabs, metrics, filters, tables, alerts, dialogs, and pagination**

Do not alter any fetch endpoint, role rule, alert copy condition, action callback, or query-param tab behavior. Replace generic rounded cards/shadows with dashboard sections, typographic metrics, border rows, and shared controls.

- [ ] **Step 3: Verify administrative routes**

Run: `npm run test:design; npm run lint; npm run build`

Inspect `/admin`, `/admin?tab=users`, and `/admin/fortune-operations` at 360px and 1440px. Expected: no page-wide x overflow, readable numeric alignment, filter wrapping, and usable dialogs.

- [ ] **Step 4: Commit admin migration**

Run: `git add app/admin tests/design-system.test.mjs && git commit -m "feat(ui): 관리자 데이터 화면 정돈"`

### Task 8: Integrate the vanilla fortune presentation

**Files:**
- Modify: `public/unse/assets/style.css`
- Modify: `public/unse/index.html`
- Modify: `public/unse/src/ui.js`
- Modify: `tests/design-system.test.mjs`

**Interfaces:**
- Consumes: task 2 exact archive color/radius/type values and existing unse DOM IDs/classes.
- Produces: a static fortune UI that shares the book/archive design without modifying calculations, AI requests, data interpretation, or routes.

- [ ] **Step 1: Read `public/unse/AGENTS.md` and run the fortune suite before edits**

Run: `npm run test:unse`

Expected: PASS before CSS/markup edits.

- [ ] **Step 2: Refactor fortune token block and component rules**

Replace the cream/brown/gold variables with exact archive variables, 4/6/8px geometry, paper/rule hierarchy, and non-pill buttons. Remove decorative `linear-gradient` declarations while retaining distinct data visualization colors only if data meaning requires them. Preserve print and reduced-motion blocks.

- [ ] **Step 3: Align entry/header/control markup without changing behavior**

Retain existing IDs, event hooks, form fields, URL behavior, and JavaScript bindings. Update only semantic classes/text wrappers necessary for the archive header, paper layout, accessible controls, and status text.

- [ ] **Step 4: Run fortune and design regression suite**

Run: `npm run test:unse; npm run test:design; npm run unse:bundle`

Expected: all pass; generated bundle only changes when source changes require it.

- [ ] **Step 5: Commit fortune integration**

Run: `git add public/unse tests/design-system.test.mjs && git commit -m "feat(unse): 아카이브 디자인 언어 적용"`

### Task 9: Full verification, visual QA, and release

**Files:**
- Modify: only files required to repair verified visual/accessibility defects from Tasks 2–8.

**Interfaces:**
- Consumes: completed tasks and all test commands.
- Produces: verified staging branch with no unrelated change.

- [ ] **Step 1: Run the complete automated verification set**

Run: `npm run test:design; npm run test:unse; npm run lint; npm run build`

Expected: all commands exit 0.

- [ ] **Step 2: Perform viewport and keyboard visual QA**

Run the app and inspect representative core, form, community, admin, and `/unse` screens at 360px, 768px, 1024px, and 1440px. Check hierarchy, color consistency, readability, focus, disabled/error states, table overflow, and modal overflow. Record only actual residual legacy CSS in the final report.

- [ ] **Step 3: Repair verified defects and rerun only the owning checks, then the full suite**

Expected: no regression and no API/data behavior change.

- [ ] **Step 4: Commit the verified QA repair set and push staging**

Run: `git add <verified-design-files> && git commit -m "fix(ui): 반응형과 접근성 보완"` only when repairs exist; then `git push origin staging`.

## Plan Self-Review

- Spec coverage: tokens/geometry/type (Task 2), primitives/accessibility (Task 3–4), all listed page families (Tasks 4–8), fortune integration (Task 8), responsive/visual QA (Task 9), and API/data exclusions (Global Constraints) are covered.
- Interface consistency: every later task consumes named classes/components created by Tasks 2–3; no data/API interface is introduced.
- Review focus ownership: header/mobile (Task 3), errors (Task 4), empty content (Task 5), table overflow (Task 7), fortune motion/print (Task 8) are explicit.
- Proportion: task details prescribe boundaries, exact files, required values, and verifications without transcribing component implementation.
