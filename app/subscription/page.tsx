'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || '';

interface SubscriptionInfo {
  id: number;
  plan: 'MONTHLY' | 'YEARLY';
  planLabel: string;
  startedAt: string;
  expiresAt: string;
  active: boolean;
  expired: boolean;
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/auth/login'); return; }

    fetch(`${API}/api/subscriptions/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setSubscription(d.data); setLoading(false); });
  }, []);

  const handleSubscribe = async (plan: 'MONTHLY' | 'YEARLY') => {
    const token = getToken();
    if (!token) return router.push('/auth/login');

    const amount = plan === 'MONTHLY' ? 9900 : 99000;
    const orderId = `chaekingam-${Date.now()}`;

    if (TOSS_CLIENT_KEY) {
      // 토스페이먼츠 결제 위젯 로드
      const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
      const toss = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: `user-${Date.now()}` });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName: plan === 'MONTHLY' ? '책인감 월간 프리미엄' : '책인감 연간 프리미엄',
        successUrl: `${window.location.origin}/subscription/success?plan=${plan}`,
        failUrl: `${window.location.origin}/subscription`,
      });
    } else {
      // 테스트 환경: 결제 없이 바로 구독
      const res = await fetch(`${API}/api/subscriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, paymentKey: 'test', orderId, amount }),
      });
      if (res.ok) {
        const d = await res.json();
        setSubscription(d.data);
        alert('구독이 완료되었습니다!');
      }
    }
  };

  const handleCancel = async () => {
    if (!confirm('구독을 해지하시겠습니까? 만료일까지는 프리미엄을 이용할 수 있습니다.')) return;
    setCancelling(true);
    const token = getToken();
    await fetch(`${API}/api/subscriptions/me`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    setSubscription(prev => prev ? { ...prev, active: false } : null);
    setCancelling(false);
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-gray-400">로딩 중...</div></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">프리미엄 구독</h1>
      <p className="text-gray-500 mb-8">광고 없이, 더 깊은 독서 경험을 즐기세요.</p>

      {subscription && !subscription.expired ? (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">구독 중</span>
            <span className="font-semibold">{subscription.planLabel}</span>
          </div>
          <p className="text-sm text-gray-600">
            만료일: {new Date(subscription.expiresAt).toLocaleDateString('ko-KR')}
          </p>
          {subscription.active && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-4 text-sm text-red-500 hover:text-red-700"
            >
              구독 해지
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 mb-8">
          {/* 월간 플랜 */}
          <div className="border border-gray-200 rounded-2xl p-6 hover:border-blue-300 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">월간 프리미엄</h3>
                <p className="text-gray-500 text-sm">매월 갱신</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">9,900<span className="text-base font-normal text-gray-500">원</span></p>
                <p className="text-xs text-gray-400">/ 월</p>
              </div>
            </div>
            <ul className="text-sm text-gray-600 space-y-2 mb-5">
              <li>✓ 광고 없는 피드</li>
              <li>✓ 독후감 무제한 번역</li>
              <li>✓ 독서 통계 상세 리포트</li>
              <li>✓ 프리미엄 배지</li>
            </ul>
            <button
              onClick={() => handleSubscribe('MONTHLY')}
              className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
            >
              월간 구독 시작
            </button>
          </div>

          {/* 연간 플랜 */}
          <div className="border-2 border-blue-500 rounded-2xl p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              16% 할인
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">연간 프리미엄</h3>
                <p className="text-gray-500 text-sm">연 1회 결제</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">99,000<span className="text-base font-normal text-gray-500">원</span></p>
                <p className="text-xs text-gray-400">/ 년 (월 8,250원)</p>
              </div>
            </div>
            <ul className="text-sm text-gray-600 space-y-2 mb-5">
              <li>✓ 월간 플랜 모든 혜택</li>
              <li>✓ 연간 독서 결산 리포트</li>
              <li>✓ 우선 고객 지원</li>
            </ul>
            <button
              onClick={() => handleSubscribe('YEARLY')}
              className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
            >
              연간 구독 시작 (가장 저렴)
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        구독은 만료일 전에 언제든지 해지할 수 있습니다. 환불은 이용약관을 따릅니다.
      </p>
    </div>
  );
}
