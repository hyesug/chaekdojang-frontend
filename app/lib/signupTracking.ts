import { sendGaEvent } from "../components/GoogleAnalytics";

// 소셜 로그인으로 처음 들어온 사용자는 /auth/callback?setup=true → /setup-nickname 을 거쳐 가입을 마친다.
// 콜백에서 표시해 두고, 닉네임 저장에 성공했을 때 GA4 sign_up 을 한 번만 보낸다.
// GA4 는 이 이벤트를 유입 경로(검색·AI 서비스·SNS)별로 나눠 보여 준다.
// (가입 건수 자체는 서버가 user_registered 이벤트로 따로 기록한다.)
const PENDING_SIGNUP_KEY = "chaekdojang:pending-signup";

export function markPendingSignup() {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_KEY, "1");
  } catch {
    // 저장소를 쓸 수 없으면 가입 이벤트만 빠진다.
  }
}

export function trackSignupCompleted() {
  try {
    if (sessionStorage.getItem(PENDING_SIGNUP_KEY) !== "1") return;
    sessionStorage.removeItem(PENDING_SIGNUP_KEY);
  } catch {
    return;
  }
  sendGaEvent("sign_up");
}
