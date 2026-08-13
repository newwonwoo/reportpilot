import { compileArticle, groundArticle } from "@/lib/gemini";
import { fetchTranscript } from "@/lib/transcript";
import { extractYouTubeVideoId, getVideoMeta } from "@/lib/youtube";
import type { AnalyzeEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.videoId || body.input || "").trim();
  const videoId = extractYouTubeVideoId(raw) ?? (/^[A-Za-z0-9_-]{11}$/.test(raw) ? raw : null);

  if (!videoId) {
    return Response.json({ error: "유효한 YouTube 영상이 아닙니다." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AnalyzeEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        send({ type: "stage", stage: "video", message: "영상 정보를 확인하고 있어요." });
        const video = await getVideoMeta(videoId);
        send({ type: "video", video });

        send({ type: "stage", stage: "transcript", message: "공개 자막을 불러오고 있어요." });
        const transcript = await fetchTranscript(videoId);
        if (transcript.length < 8) throw new Error("글로 만들 만큼 충분한 자막이 없습니다.");

        send({ type: "stage", stage: "structure", message: "주제 전환점을 찾고 글의 흐름을 정리하고 있어요." });
        const draft = await compileArticle(transcript);

        send({ type: "stage", stage: "grounding", message: "각 대목을 원문 시간과 다시 연결하고 있어요." });
        const article = groundArticle(draft, transcript);

        send({ type: "stage", stage: "complete", message: "글 정리가 끝났습니다." });
        send({ type: "result", article: { video, ...article } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
