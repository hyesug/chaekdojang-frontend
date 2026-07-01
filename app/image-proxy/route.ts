import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("url");
  if (!src) {
    return new NextResponse("Missing image url", { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(src.startsWith("//") ? `https:${src}` : src);
  } catch {
    return new NextResponse("Invalid image url", { status: 400 });
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return new NextResponse("Unsupported image url", { status: 400 });
  }

  const upstream = await fetch(url, {
    headers: {
      "User-Agent": "chaekdojang-image-proxy",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Image fetch failed", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
    },
  });
}
