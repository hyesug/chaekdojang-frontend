"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/auth";

type Summary = { newUsers:number; chartUsers:number; aiUsers:number; payingUsers:number; payments:number; revenue:number; refunds:number; netRevenue:number; grantedCredits:number; usedCredits:number; aiCost:string; averageAiCost:string; aiCostRate:string|null };
type Funnel = { eventName:string; users:number };
const money = new Intl.NumberFormat("ko-KR");

export default function FortuneOperationsPage() {
  const [days,setDays]=useState(7); const [data,setData]=useState<{kpi:Summary;funnel:Funnel[]}|null>(null); const [error,setError]=useState("");
  useEffect(()=>{ const to=new Date(); const from=new Date(to.getTime()-days*86400000); authFetch(`/api/admin/fortune-operations/summary?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`).then(async r=>{if(!r.ok)throw new Error(r.status===403?"관리자 권한이 필요합니다.":"통계를 불러오지 못했습니다.");return r.json();}).then(v=>setData(v.data)).catch(e=>setError(e.message)); },[days]);
  const k=data?.kpi; const cards=k?[['신규 가입자',k.newUsers],['명반 생성 사용자',k.chartUsers],['AI 질문 사용자',k.aiUsers],['결제 사용자',k.payingUsers],['결제 건수',k.payments],['매출',`${money.format(k.revenue)}원`],['환불액',`${money.format(k.refunds)}원`],['순매출',`${money.format(k.netRevenue)}원`],['지급/사용 질문권',`${k.grantedCredits} / ${k.usedCredits}`],['AI 총 원가',`${k.aiCost} USD`],['질문당 평균 원가',`${k.averageAiCost} USD`],['AI 원가율',k.aiCostRate===null?'데이터 없음':`${k.aiCostRate}%`]]:[];
  return <main className="mx-auto max-w-6xl px-5 py-8 text-brown-700"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-sage-700">운세 AI 운영</p><h1 className="font-serif text-3xl font-bold text-brown-900">매출·원가·퍼널</h1></div><Link href="/admin" className="text-sm underline">기존 관리자</Link></div><div className="mt-6 flex gap-2">{[1,7,30].map(d=><button key={d} onClick={()=>setDays(d)} className={`rounded-lg px-3 py-2 text-sm ${days===d?'bg-brown-700 text-white':'border'}`}>{d===1?'오늘':`최근 ${d}일`}</button>)}</div>{error?<p className="mt-6 rounded-lg bg-red-50 p-4" role="alert">{error}</p>:!k?<p className="mt-6">불러오는 중…</p>:<><section className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{cards.map(([name,value])=><article key={String(name)} className="rounded-xl border bg-white p-4"><p className="text-xs text-brown-400">{name}</p><p className="mt-1 text-lg font-bold text-brown-900">{value}</p></article>)}</section><section className="mt-8"><h2 className="font-serif text-xl font-bold text-brown-900">운세 퍼널</h2><p className="mt-1 text-sm text-brown-400">고유 사용자 또는 비로그인 세션 수입니다. 표본 20 미만은 해석에 주의하세요.</p><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">이벤트</th><th className="p-3">사용자/세션</th><th className="p-3">표본 상태</th></tr></thead><tbody>{data.funnel.map(x=><tr key={x.eventName} className="border-b"><td className="p-3">{x.eventName}</td><td className="p-3">{x.users}</td><td className="p-3">{x.users<20?'표본 적음':'해석 가능'}</td></tr>)}</tbody></table></div></section></>}</main>;
}
