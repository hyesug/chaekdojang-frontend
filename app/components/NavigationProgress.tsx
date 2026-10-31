"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

// 페이지를 옮기는 동안 화면 맨 위에 얇은 막대를 보여 준다.
// 예전에는 app/loading.tsx 의 뼈대 화면이 이 역할을 했지만, 그 경계 때문에 긴 페이지의 본문이
// HTML 의 숨김 블록(<div hidden>)으로 밀려나 JS 를 돌리지 않는 AI 수집기가 본문을 읽지 못했다.

// 미리 받아 둔 페이지는 바로 열리므로, 이보다 빨리 끝나면 막대를 아예 보이지 않는다(깜빡임 방지).
const SHOW_DELAY_MS = 120;
// 이동이 취소되는 등 주소가 끝내 바뀌지 않아도 막대가 남지 않게 한다.
const SAFETY_TIMEOUT_MS = 10_000;

type Timers = { show?: number; trickle?: number; safety?: number; hide?: number };

function clearTimers(timers: Timers) {
  window.clearTimeout(timers.show);
  window.clearInterval(timers.trickle);
  window.clearTimeout(timers.safety);
  window.clearTimeout(timers.hide);
  timers.show = timers.trickle = timers.safety = timers.hide = undefined;
}

// 이 클릭이 사이트 안 다른 주소로 옮기는 클릭인가. 새 탭·다운로드·바깥 사이트·같은 페이지(#) 이동은 뺀다.
function isInternalNavigation(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export default function NavigationProgress() {
  const routeKey = `${usePathname()}?${useSearchParams().toString()}`;
  const barRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const pendingRef = useRef(false);
  const timersRef = useRef<Timers>({});

  useEffect(() => {
    const bar = barRef.current;
    const status = statusRef.current;
    if (!bar || !status) return;
    const timers = timersRef.current;

    function paint(width: number, visible: boolean) {
      bar!.style.width = `${width}%`;
      bar!.style.opacity = visible ? "1" : "0";
    }

    function finish() {
      if (!pendingRef.current) return;
      pendingRef.current = false;
      const shown = timers.trickle !== undefined;
      clearTimers(timers);
      status!.textContent = "";
      if (!shown) return;
      paint(100, true);
      // 끝까지 채운 뒤 흐리게 지우고, 안 보일 때 길이를 되돌린다(줄어드는 모습이 보이지 않게).
      timers.hide = window.setTimeout(() => {
        paint(100, false);
        timers.hide = window.setTimeout(() => paint(0, false), 300);
      }, 200);
    }

    function start() {
      clearTimers(timers);
      pendingRef.current = true;
      let width = 0;
      timers.show = window.setTimeout(() => {
        width = 15;
        paint(width, true);
        status!.textContent = "페이지를 불러오는 중입니다";
        timers.trickle = window.setInterval(() => {
          width += (90 - width) * 0.1;
          paint(width, true);
        }, 300);
      }, SHOW_DELAY_MS);
      timers.safety = window.setTimeout(finish, SAFETY_TIMEOUT_MS);
    }

    // 주소가 바뀌어 이 effect 가 다시 돌았다면, 진행 중이던 이동은 끝난 것이다.
    finish();

    function onClick(event: MouseEvent) {
      if (isInternalNavigation(event)) start();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [routeKey]);

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
        <div
          ref={barRef}
          className="h-full w-0 bg-brown-700 opacity-0 transition-[width,opacity] duration-300 ease-out motion-reduce:transition-none"
        />
      </div>
      <p ref={statusRef} role="status" className="sr-only" />
    </>
  );
}
