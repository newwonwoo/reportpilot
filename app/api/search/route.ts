import { NextResponse } from "next/server";
import { searchYouTube } from "@/lib/youtube";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  if (q.length > 200) {
    return NextResponse.json({ error: "검색어는 200자 이내로 입력해 주세요." }, { status: 400 });
  }

  try {
    const results = await searchYouTube(q);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
