import { cookies } from "next/headers";
import { SERVER_API_BASE } from "../lib/serverApi";

export async function fetchGroupApiData<T>(
  path: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    const headers = new Headers(options.headers);
    headers.set("X-Chaekdojang-Internal-Request", "web-ssr");
    const cookieHeader = (await cookies()).toString();
    if (cookieHeader) headers.set("Cookie", cookieHeader);

    const res = await fetch(`${SERVER_API_BASE}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}
