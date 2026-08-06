"use client";

import { useState } from "react";
import { trackMetric } from "../../components/AnalyticsTracker";
import {
  COPY_GROUP_INVITE_SOURCE,
  GROUP_INVITE_SOURCE_PARAM,
  KAKAO_GROUP_INVITE_SOURCE,
  type GroupInviteSource,
} from "../../lib/inviteTracking";

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (options: Record<string, unknown>) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js";
const SDK_INTEGRITY = "sha384-OL+ylM/iuPLtW5U3XcvLSGhE8JzReKDank5InqlHGWPhb4140/yrBw0bg0y7+C9J";
let kakaoSdkPromise: Promise<KakaoSdk> | null = null;

function loadKakaoSdk() {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  if (kakaoSdkPromise) return kakaoSdkPromise;
  kakaoSdkPromise = new Promise<KakaoSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    existing?.remove();
    const script = document.createElement("script");
    const handleLoad = () => window.Kakao ? resolve(window.Kakao) : reject(new Error("Kakao SDK unavailable"));
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Kakao SDK load failed")), { once: true });
    script.src = SDK_URL;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }).catch((error) => {
    kakaoSdkPromise = null;
    throw error;
  });
  return kakaoSdkPromise;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy failed");
}

export default function GroupInviteShare({
  slug,
  name,
  description,
  imageUrl,
  currentBook,
  deadline,
}: {
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentBook: string | null;
  deadline: string | null;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function inviteUrl(source: GroupInviteSource) {
    const url = new URL(`/invite/groups/${encodeURIComponent(slug)}`, window.location.origin);
    url.searchParams.set(GROUP_INVITE_SOURCE_PARAM, source);
    return url.href;
  }

  function shareDescription() {
    const details = [currentBook ? `읽는 책: ${currentBook}` : null, deadline ? `마감일: ${deadline}` : null]
      .filter(Boolean)
      .join(" · ");
    return details || description || "책도장에서 함께 읽고 독후감을 나눠요.";
  }

  async function copyInviteLink(
    source: GroupInviteSource = COPY_GROUP_INVITE_SOURCE,
    successMessage = "초대 링크를 복사했어요.",
  ) {
    try {
      await copyText(inviteUrl(source));
      trackMetric("share_click", `/groups/${slug}`, 0, {
        groupSlug: slug,
        channel: source === KAKAO_GROUP_INVITE_SOURCE ? "kakao_copy_fallback" : "copy",
      });
      setMessage(successMessage);
    } catch {
      setMessage("링크를 복사하지 못했어요. 주소창의 링크를 복사해주세요.");
    }
  }

  async function shareToKakao() {
    setLoading(true);
    setMessage("");
    const javascriptKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    if (!javascriptKey) {
      await copyInviteLink(KAKAO_GROUP_INVITE_SOURCE, "카카오 설정 전이라 초대 링크를 대신 복사했어요.");
      setLoading(false);
      return;
    }
    try {
      const kakao = await loadKakaoSdk();
      if (!kakao.isInitialized()) kakao.init(javascriptKey);
      const url = inviteUrl(KAKAO_GROUP_INVITE_SOURCE);
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: `${name} 독서모임에 초대합니다`,
          description: shareDescription(),
          imageUrl: imageUrl ? new URL(imageUrl, window.location.origin).href : `${window.location.origin}/chaekdojang-logo-1024.png`,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [
          {
            title: "독서모임 참여하기",
            link: { mobileWebUrl: url, webUrl: url },
          },
        ],
      });
      trackMetric("share_click", `/groups/${slug}`, 0, { groupSlug: slug, channel: "kakao" });
    } catch {
      await copyInviteLink(KAKAO_GROUP_INVITE_SOURCE, "카카오톡 공유를 열지 못해 초대 링크를 복사했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={shareToKakao}
          disabled={loading}
          className="rounded-full bg-[#FEE500] px-4 py-2 text-sm font-semibold text-[#191919] hover:bg-[#f5dc00] disabled:opacity-50"
        >
          {loading ? "준비 중..." : "카카오톡으로 초대"}
        </button>
        <button
          type="button"
          onClick={() => void copyInviteLink()}
          className="rounded-full border border-cream-300 px-4 py-2 text-sm font-semibold text-brown-600 hover:bg-cream-50"
        >
          초대 링크 복사
        </button>
      </div>
      {message && <p className="text-xs text-brown-400">{message}</p>}
    </div>
  );
}
