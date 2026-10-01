"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "../lib/auth";

type Product = { code: string; name: string; credits: number; price: number; validDays: number };
type Balance = { freeRemaining: number; purchasedBalance: number; totalBalance: number };
type History = { amount: number; type: string; description: string; createdAt: string };

declare global {
  interface Window { PortOne?: { requestPayment(request: Record<string, unknown>): Promise<{ code?: string; message?: string; paymentId?: string }> }; }
}

const money = new Intl.NumberFormat("ko-KR");

export default function AiCreditsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [productRes, creditRes] = await Promise.all([authFetch("/api/ai-credit-orders/products"), authFetch("/api/fortune-ai/credits/me")]);
    if (productRes.status === 401 || creditRes.status === 401) { router.push("/auth/login?next=/ai-credits"); return; }
    const productJson = await productRes.json();
    const creditJson = await creditRes.json();
    setProducts(productJson.data ?? []);
    setBalance(creditJson.data?.balance ?? null);
    setHistory(creditJson.data?.recentHistory ?? []);
  }, [router]);

  useEffect(() => { load().catch(() => setMessage("질문권 정보를 불러오지 못했습니다.")); }, [load]);

  async function buy(product: Product) {
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey || !window.PortOne) { setMessage("결제 설정을 준비 중입니다. 잠시 후 다시 시도해주세요."); return; }
    setBusy(product.code); setMessage("");
    try {
      const create = await authFetch("/api/ai-credit-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product: product.code }) });
      const orderJson = await create.json();
      if (!create.ok) throw new Error(orderJson.message);
      const order = orderJson.data as { orderId: string; paymentId: string; productName: string; amount: number };
      const result = await window.PortOne.requestPayment({ storeId, channelKey, paymentId: order.paymentId, orderName: `책도장 AI ${order.productName}`, totalAmount: order.amount, currency: "KRW", payMethod: "CARD", redirectUrl: `${window.location.origin}/ai-credits` });
      if (result.code) throw new Error(result.message ?? "결제가 취소되었습니다.");
      const complete = await authFetch(`/api/ai-credit-orders/${order.orderId}/complete`, { method: "POST" });
      const completeJson = await complete.json();
      if (!complete.ok) throw new Error(completeJson.message ?? "결제 확인에 실패했습니다.");
      setMessage("질문권을 지급했습니다.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "결제를 완료하지 못했습니다."); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto max-w-3xl px-4 py-8">
    <Script src="https://cdn.portone.io/v2/browser-sdk.js" strategy="afterInteractive" />
    <p className="text-xs font-semibold text-sage-700">AI 운세 질문권</p>
    <h1 className="mt-1 font-serif text-3xl font-bold text-brown-900">내 질문권</h1>
    <p className="mt-2 text-sm leading-6 text-brown-500">Claude Sonnet·GPT Sol은 1회, Claude Opus는 2회, GPT Astra는 5회가 차감됩니다.</p>
    <section className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-cream-200 bg-white p-5 text-center shadow-sm">
      <div><p className="text-xs text-brown-400">무료</p><p className="mt-1 text-xl font-bold text-brown-800">{balance?.freeRemaining ?? "-"}회</p></div>
      <div><p className="text-xs text-brown-400">구매</p><p className="mt-1 text-xl font-bold text-brown-800">{balance?.purchasedBalance ?? "-"}회</p></div>
      <div><p className="text-xs text-brown-400">총 잔액</p><p className="mt-1 text-xl font-bold text-sage-700">{balance?.totalBalance ?? "-"}회</p></div>
    </section>
    <section className="mt-8"><h2 className="font-serif text-xl font-bold text-brown-900">기간권</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{products.filter((p) => p.validDays > 0).map((p) => <ProductCard key={p.code} product={p} busy={busy === p.code} onBuy={buy} />)}</div></section>
    <section className="mt-8"><h2 className="font-serif text-xl font-bold text-brown-900">질문권 묶음</h2><p className="mt-1 text-xs text-brown-400">만료일 없이 필요한 만큼 사용할 수 있어요.</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{products.filter((p) => p.validDays === 0).map((p) => <ProductCard key={p.code} product={p} busy={busy === p.code} onBuy={buy} />)}</div></section>
    <section className="mt-8"><h2 className="font-serif text-xl font-bold text-brown-900">최근 내역</h2><div className="mt-3 overflow-hidden rounded-2xl border border-cream-200 bg-white">{history.length === 0 ? <p className="p-5 text-sm text-brown-400">아직 사용 내역이 없습니다.</p> : history.map((item, index) => <div key={`${item.createdAt}-${index}`} className="flex items-center justify-between border-b border-cream-100 px-5 py-3 last:border-0"><div><p className="text-sm text-brown-700">{item.description}</p><p className="mt-1 text-xs text-brown-400">{new Date(item.createdAt).toLocaleString("ko-KR")}</p></div><strong className={item.amount > 0 ? "text-sage-700" : "text-brown-700"}>{item.amount > 0 ? "+" : ""}{item.amount}회</strong></div>)}</div></section>
    {message && <p role="status" className="mt-5 text-sm text-brown-600">{message}</p>}
  </main>;
}

function ProductCard({ product, busy, onBuy }: { product: Product; busy: boolean; onBuy(product: Product): void }) {
  return <article className="rounded-2xl border border-cream-200 bg-white p-5 shadow-sm"><p className="font-serif text-lg font-bold text-brown-800">{product.name}</p><p className="mt-2 text-sm text-brown-500">질문권 {product.credits}회{product.validDays > 0 ? ` · 구매 후 ${product.validDays}일` : " · 만료 없음"}</p><p className="mt-4 text-xl font-bold text-brown-900">{money.format(product.price)}원</p><button type="button" disabled={busy} onClick={() => onBuy(product)} className="mt-4 w-full rounded-xl bg-brown-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "결제창 여는 중..." : "구매하기"}</button></article>;
}
