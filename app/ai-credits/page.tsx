"use client";

import Script from "next/script";
import Link from "next/link";
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
const salesReady = [
  process.env.NEXT_PUBLIC_BUSINESS_NAME,
  process.env.NEXT_PUBLIC_BUSINESS_REPRESENTATIVE,
  process.env.NEXT_PUBLIC_BUSINESS_ADDRESS,
  process.env.NEXT_PUBLIC_BUSINESS_REGISTRATION_NUMBER,
  process.env.NEXT_PUBLIC_BUSINESS_SALES_REGISTRATION_NUMBER,
  process.env.NEXT_PUBLIC_CUSTOMER_SERVICE_CONTACT,
].every(Boolean);

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
    if (!salesReady || !storeId || !channelKey || !window.PortOne) { setMessage("판매자 정보와 결제 설정을 준비 중입니다."); return; }
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

  return <main className="cdj-page cdj-page--reading">
    <Script src="https://cdn.portone.io/v2/browser-sdk.js" strategy="afterInteractive" />
    <header className="border-b border-cream-300 pb-6">
      <p className="cdj-kicker">책도장 · AI 명반 해석</p>
      <h1 className="cdj-title mt-2">내 질문권</h1>
      <p className="mt-3 text-sm leading-6 text-brown-500">AI 해석은 계산된 명반을 바탕으로 답합니다. 모델별 질문권 차감량은 선택 메뉴에서 확인할 수 있습니다.</p>
    </header>
    {!salesReady && <p className="cdj-alert cdj-alert--warning mt-6 text-sm leading-6" role="status">유료 판매는 사업자 정보, 환불 정책 및 PG 심사가 확정된 뒤에 시작합니다. 현재는 질문권 현황만 확인할 수 있습니다.</p>}
    <section className="cdj-section mt-7 py-5" aria-label="현재 질문권 잔액">
      <dl className="grid grid-cols-3 gap-3 text-center tabular-nums">
        <div><dt className="text-xs text-brown-400">무료</dt><dd className="mt-1 text-xl font-semibold text-brown-800">{balance?.freeRemaining ?? "-"}회</dd></div>
        <div><dt className="text-xs text-brown-400">구매</dt><dd className="mt-1 text-xl font-semibold text-brown-800">{balance?.purchasedBalance ?? "-"}회</dd></div>
        <div><dt className="text-xs text-brown-400">총 잔액</dt><dd className="mt-1 text-xl font-semibold text-sage-700">{balance?.totalBalance ?? "-"}회</dd></div>
      </dl>
    </section>
    <ProductSection title="기간권" note="구매 후 정해진 기간 동안 사용할 수 있습니다." products={products.filter((p) => p.validDays > 0)} busy={busy} salesReady={salesReady} onBuy={buy} />
    <ProductSection title="질문권 묶음" note="만료일 없이 필요한 만큼 사용할 수 있습니다." products={products.filter((p) => p.validDays === 0)} busy={busy} salesReady={salesReady} onBuy={buy} />
    <section className="cdj-section mt-9 py-5"><h2 className="cdj-heading text-xl">최근 내역</h2><div className="cdj-table-wrap mt-4">{history.length === 0 ? <p className="p-5 text-sm text-brown-400">아직 사용 내역이 없습니다.</p> : <table className="w-full text-sm"><tbody>{history.map((item, index) => <tr key={`${item.createdAt}-${index}`} className="border-b border-cream-200 last:border-0"><td className="px-3 py-3"><p className="text-brown-700">{item.description}</p><p className="mt-1 text-xs text-brown-400">{new Date(item.createdAt).toLocaleString("ko-KR")}</p></td><td className={item.amount > 0 ? "px-3 py-3 text-right font-semibold text-sage-700" : "px-3 py-3 text-right font-semibold text-brown-700"}>{item.amount > 0 ? "+" : ""}{item.amount}회</td></tr>)}</tbody></table>}</div></section>
    {message && <p role="status" aria-live="polite" className="cdj-alert mt-5 text-sm">{message}</p>}
  </main>;
}

function ProductSection({ title, note, products, busy, salesReady, onBuy }: { title: string; note: string; products: Product[]; busy: string | null; salesReady: boolean; onBuy(product: Product): void }) {
  return <section className="cdj-section mt-9 py-5"><h2 className="cdj-heading text-xl">{title}</h2><p className="mt-1 text-xs text-brown-400">{note}</p><div className="mt-4 border-y border-cream-300">{products.map((product) => <ProductRow key={product.code} product={product} busy={busy === product.code} salesReady={salesReady} onBuy={onBuy} />)}</div></section>;
}

function ProductRow({ product, busy, salesReady, onBuy }: { product: Product; busy: boolean; salesReady: boolean; onBuy(product: Product): void }) {
  return <article className="grid gap-4 border-b border-cream-200 py-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-serif text-lg font-semibold text-brown-800">{product.name}</p><p className="mt-1 text-sm text-brown-500">질문권 {product.credits}회{product.validDays > 0 ? ` · 구매 후 ${product.validDays}일` : " · 만료 없음"} · {money.format(product.price)}원</p><p className="mt-2 text-xs leading-5 text-brown-400"><Link className="underline underline-offset-2" href="/payment-info">환불·결제 안내</Link> · <Link className="underline underline-offset-2" href="/terms">이용약관</Link> · <Link className="underline underline-offset-2" href="/privacy">개인정보처리방침</Link></p></div><button type="button" aria-busy={busy} disabled={busy || !salesReady} onClick={() => onBuy(product)} className="cdj-button cdj-button--primary w-full sm:w-auto">{busy ? "결제창 여는 중..." : salesReady ? "구매하기" : "판매 준비 중"}</button></article>;
}
