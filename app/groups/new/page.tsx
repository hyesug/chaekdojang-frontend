"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/api";
import { authFetch } from "../../lib/auth";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinPolicy, setJoinPolicy] = useState<"OPEN" | "APPROVAL">("OPEN");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("모임 이름을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility,
          joinPolicy,
        }),
      });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const group = json.data ?? json;
      router.push(`/groups/${group.slug}`);
    } catch {
      setError("독서모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-brown-900">독서모임 만들기</h1>
      <p className="mt-2 text-sm leading-6 text-brown-500">
        모임장이 선정 책을 등록하고, 멤버들이 쓴 독후감을 모아볼 수 있습니다.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-cream-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium text-brown-700">모임 이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-900 focus:border-brown-400 focus:outline-none"
            placeholder="예: 일요일 아침 독서모임"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-brown-700">소개글</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            maxLength={2000}
            className="mt-1 w-full rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-brown-900 focus:border-brown-400 focus:outline-none"
            placeholder="어떤 책을 어떤 방식으로 읽는 모임인지 적어주세요."
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-brown-700">공개 여부</span>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")}
              className="mt-1 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-700 focus:border-brown-400 focus:outline-none"
            >
              <option value="PUBLIC">공개</option>
              <option value="PRIVATE">비공개</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-brown-700">가입 방식</span>
            <select
              value={joinPolicy}
              onChange={(event) => setJoinPolicy(event.target.value as "OPEN" | "APPROVAL")}
              className="mt-1 w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-brown-700 focus:border-brown-400 focus:outline-none"
            >
              <option value="OPEN">바로 가입</option>
              <option value="APPROVAL">승인 후 가입</option>
            </select>
          </label>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brown-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brown-800 disabled:opacity-50"
        >
          {loading ? "만드는 중..." : "독서모임 만들기"}
        </button>
      </form>
    </main>
  );
}
